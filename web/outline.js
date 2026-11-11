// A letter's outline, as Photoshop's Convert to Shape gives it: closed paths of anchor points,
// each with the handles of the curves on either side, which a letterer pulls one by one.
//
// A path (`contour`) is a list of points [x, y, inX, inY, outX, outY, smooth]: the anchor, the
// handle of the curve coming in, the handle of the curve going out (all where they are, not
// relative to the anchor), and 1 when the two handles stay in line. From each point to the
// next one goes a cubic Bézier curve; the last one closes the path. Outer paths go one way
// round and their holes the other, so that they fill as the letter does (nonzero).
//
// The letters TypeR draws come from fonts it can't read the outlines of: their outline is
// traced from the letter drawn large (marching squares on its edge), then fitted with curves
// (Philip J. Schneider's algorithm, Graphics Gems, 1990) between the corners it finds.

(() => {
  "use strict";

  const hypot = Math.hypot;

  /* --------------------------------- tracing --------------------------------- */

  // The edges of what is opaque in `alpha` (w × h, one value per pixel, 0 to 255), at half,
  // between pixels: closed polylines as [x0, y0, x1, y1…], in pixels from the picture's top left
  const traceEdges = (alpha, w, h, iso = 128) => {
    const W = w + 2;
    const H = h + 2;
    // One pixel of nothing all round, so that every edge closes
    const at = (i, j) => (i <= 0 || j <= 0 || i > w || j > h ? 0 : alpha[(j - 1) * w + (i - 1)]);
    const links = new Int32Array(W * H * 4).fill(-1);
    const link = (a, b) => {
      if (links[a * 2] < 0) links[a * 2] = b;
      else links[a * 2 + 1] = b;
    };
    const join = (a, b) => {
      link(a, b);
      link(b, a);
    };
    // Edge ids: across, between (i, j) and (i + 1, j); down, between (i, j) and (i, j + 1)
    const across = (i, j) => (j * W + i) * 2;
    const down = (i, j) => (j * W + i) * 2 + 1;
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const tl = at(i, j) >= iso;
        const tr = at(i + 1, j) >= iso;
        const br = at(i + 1, j + 1) >= iso;
        const bl = at(i, j + 1) >= iso;
        const code = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
        if (code === 0 || code === 15) continue;
        const top = across(i, j);
        const bottom = across(i, j + 1);
        const left = down(i, j);
        const right = down(i + 1, j);
        if (code === 5 || code === 10) {
          // Two corners in, across from each other: joined through the middle if it is in
          const middle = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 >= iso;
          if ((code === 5) === middle) {
            join(top, right);
            join(left, bottom);
          } else {
            join(top, left);
            join(right, bottom);
          }
          continue;
        }
        const crossed = [];
        if (tl !== tr) crossed.push(top);
        if (tr !== br) crossed.push(right);
        if (bl !== br) crossed.push(bottom);
        if (tl !== bl) crossed.push(left);
        if (crossed.length === 2) join(crossed[0], crossed[1]);
      }
    }
    // Where an edge is crossed, between its two pixels' centres
    const pointOf = (id) => {
      const vertical = id & 1;
      const cell = id >> 1;
      const i = cell % W;
      const j = (cell - i) / W;
      const a = at(i, j);
      const b = vertical ? at(i, j + 1) : at(i + 1, j);
      const t = a === b ? 0.5 : Math.max(0, Math.min(1, (iso - a) / (b - a)));
      return vertical ? [i - 0.5, j - 0.5 + t] : [i - 0.5 + t, j - 0.5];
    };
    const seen = new Uint8Array(W * H * 2);
    const loops = [];
    for (let start = 0; start < W * H * 2; start++) {
      if (seen[start] || links[start * 2] < 0) continue;
      const loop = [];
      let previous = -1;
      let current = start;
      while (current >= 0 && !seen[current]) {
        seen[current] = 1;
        const [x, y] = pointOf(current);
        loop.push(x, y);
        const a = links[current * 2];
        const b = links[current * 2 + 1];
        const next = a !== previous ? a : b;
        previous = current;
        current = next;
      }
      if (loop.length >= 8) loops.push(loop);
    }
    return loops;
  };

  const areaOf = (loop) => {
    let sum = 0;
    const n = loop.length;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      sum += loop[i] * loop[j + 1] - loop[j] * loop[i + 1];
    }
    return sum / 2;
  };
  const insideLoop = (loop, x, y) => {
    let inside = false;
    const n = loop.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = loop[i];
      const yi = loop[i + 1];
      const xj = loop[j];
      const yj = loop[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  /* --------------------------------- fitting --------------------------------- */

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const unit = (a) => {
    const l = hypot(a[0], a[1]);
    return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0];
  };
  const bezierAt = (bez, t) => {
    const s = 1 - t;
    const a = s * s * s;
    const b = 3 * s * s * t;
    const c = 3 * s * t * t;
    const d = t * t * t;
    return [a * bez[0][0] + b * bez[1][0] + c * bez[2][0] + d * bez[3][0], a * bez[0][1] + b * bez[1][1] + c * bez[2][1] + d * bez[3][1]];
  };
  const derivative = (bez, t) => {
    const s = 1 - t;
    return [
      3 * (s * s * (bez[1][0] - bez[0][0]) + 2 * s * t * (bez[2][0] - bez[1][0]) + t * t * (bez[3][0] - bez[2][0])),
      3 * (s * s * (bez[1][1] - bez[0][1]) + 2 * s * t * (bez[2][1] - bez[1][1]) + t * t * (bez[3][1] - bez[2][1])),
    ];
  };
  const second = (bez, t) => {
    const s = 1 - t;
    return [
      6 * (s * (bez[2][0] - 2 * bez[1][0] + bez[0][0]) + t * (bez[3][0] - 2 * bez[2][0] + bez[1][0])),
      6 * (s * (bez[2][1] - 2 * bez[1][1] + bez[0][1]) + t * (bez[3][1] - 2 * bez[2][1] + bez[1][1])),
    ];
  };

  const chordParameters = (points, first, last) => {
    const u = [0];
    for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = u[u.length - 1] || 1;
    return u.map((value) => value / total);
  };
  // The curve from points[first] to points[last] leaving and arriving along t1 and t2 (t2 points
  // back, from the end), its handles as long as the points ask in the least squares
  const generateBezier = (points, first, last, u, t1, t2) => {
    const p0 = points[first];
    const p3 = points[last];
    const c = [[0, 0], [0, 0]];
    const x = [0, 0];
    for (let i = 0; i < u.length; i++) {
      const t = u[i];
      const s = 1 - t;
      const a1 = mul(t1, 3 * s * s * t);
      const a2 = mul(t2, 3 * s * t * t);
      c[0][0] += dot(a1, a1);
      c[0][1] += dot(a1, a2);
      c[1][0] = c[0][1];
      c[1][1] += dot(a2, a2);
      const tmp = sub(points[first + i], add(mul(p0, s * s * s + 3 * s * s * t), mul(p3, 3 * s * t * t + t * t * t)));
      x[0] += dot(a1, tmp);
      x[1] += dot(a2, tmp);
    }
    const det = c[0][0] * c[1][1] - c[1][0] * c[0][1];
    let alphaL = det === 0 ? 0 : (x[0] * c[1][1] - x[1] * c[0][1]) / det;
    let alphaR = det === 0 ? 0 : (c[0][0] * x[1] - c[1][0] * x[0]) / det;
    const length = hypot(p3[0] - p0[0], p3[1] - p0[1]);
    const epsilon = 1e-6 * length;
    if (alphaL < epsilon || alphaR < epsilon || alphaL > length * 2 || alphaR > length * 2) {
      alphaL = length / 3;
      alphaR = length / 3;
    }
    return [p0, add(p0, mul(t1, alphaL)), add(p3, mul(t2, alphaR)), p3];
  };
  const maxError = (points, first, last, bez, u) => {
    let most = 0;
    let split = Math.floor((last - first + 1) / 2) + first;
    for (let i = first + 1; i < last; i++) {
      const p = bezierAt(bez, u[i - first]);
      const d = (p[0] - points[i][0]) ** 2 + (p[1] - points[i][1]) ** 2;
      if (d >= most) {
        most = d;
        split = i;
      }
    }
    return [most, split];
  };
  const reparameterize = (points, first, last, u, bez) => u.map((t, i) => {
    const p = points[first + i];
    const q = bezierAt(bez, t);
    const q1 = derivative(bez, t);
    const q2 = second(bez, t);
    const numerator = (q[0] - p[0]) * q1[0] + (q[1] - p[1]) * q1[1];
    const denominator = q1[0] * q1[0] + q1[1] * q1[1] + (q[0] - p[0]) * q2[0] + (q[1] - p[1]) * q2[1];
    if (Math.abs(denominator) < 1e-12) return t;
    return Math.max(0, Math.min(1, t - numerator / denominator));
  });
  const fitCubic = (points, first, last, t1, t2, error, out, depth = 0) => {
    if (last - first === 1 || depth > 24) {
      const d = hypot(points[last][0] - points[first][0], points[last][1] - points[first][1]) / 3;
      out.push([points[first], add(points[first], mul(t1, d)), add(points[last], mul(t2, d)), points[last]]);
      return;
    }
    let u = chordParameters(points, first, last);
    let bez = generateBezier(points, first, last, u, t1, t2);
    let [most, split] = maxError(points, first, last, bez, u);
    if (most < error) {
      out.push(bez);
      return;
    }
    if (most < error * 4) {
      for (let k = 0; k < 12; k++) {
        u = reparameterize(points, first, last, u, bez);
        bez = generateBezier(points, first, last, u, t1, t2);
        [most, split] = maxError(points, first, last, bez, u);
        if (most < error) {
          out.push(bez);
          return;
        }
      }
    }
    split = Math.max(first + 1, Math.min(last - 1, split));
    const centre = unit(sub(points[split - 1], points[split + 1]));
    fitCubic(points, first, split, t1, centre, error, out, depth + 1);
    fitCubic(points, split, last, mul(centre, -1), t2, error, out, depth + 1);
  };
  // Leaving `points[i]` forward (or back), along the next few points
  const tangentFrom = (points, i, step, reach) => {
    const p = points[i];
    let k = i;
    let travelled = 0;
    let q = p;
    for (let n = 0; n < points.length && travelled < reach; n++) {
      const next = points[(k + step + points.length) % points.length];
      travelled += hypot(next[0] - q[0], next[1] - q[1]);
      q = next;
      k = (k + step + points.length) % points.length;
    }
    return unit(sub(q, p));
  };

  // How a run leaves its corner (`way` 1) or arrives at the next (-1, pointing back): along a
  // chord a little past the corner, which the edge's trace cuts at an angle
  const runTangent = (run, way, reach) => {
    const n = run.length;
    const end = way > 0 ? 0 : n - 1;
    const half = [];
    let travelled = 0;
    for (let k = 1; k < n; k++) {
      const i = way > 0 ? k : n - 1 - k;
      const j = way > 0 ? k - 1 : n - k;
      travelled += hypot(run[i][0] - run[j][0], run[i][1] - run[j][1]);
      half.push([i, travelled]);
    }
    const total = travelled;
    const nearAt = Math.min(1.2, total * 0.15);
    const farAt = Math.min(reach * 1.5, total * 0.45);
    let near = run[end];
    let far = null;
    for (const [i, d] of half) {
      if (d <= nearAt) near = run[i];
      if (d <= farAt) far = run[i];
    }
    if (!far || far === near) far = run[way > 0 ? Math.min(n - 1, 1) : Math.max(0, n - 2)];
    const t = unit(sub(far, near));
    return t[0] || t[1] ? t : unit(sub(run[way > 0 ? n - 1 : 0], run[end]));
  };

  // Where a closed polyline turns sharply: its corners, as indices
  const cornersOf = (points, reach, angle) => {
    const n = points.length;
    if (n < 6) return [];
    const turn = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const back = tangentFrom(points, i, -1, reach);
      const ahead = tangentFrom(points, i, 1, reach);
      // 0 when going straight on, π when turning right round
      turn[i] = Math.acos(Math.max(-1, Math.min(1, -dot(back, ahead))));
    }
    const out = [];
    const window = Math.max(2, Math.round(reach));
    for (let i = 0; i < n; i++) {
      if (turn[i] < angle) continue;
      // The sharpest around, the first of equals
      let best = true;
      for (let k = 1; k <= window && best; k++) {
        if (turn[(i + k) % n] > turn[i] || turn[(i - k + n) % n] >= turn[i]) best = false;
      }
      if (best) out.push(i);
    }
    // Two too close: the sharper one
    return out.filter((i, k) => {
      const j = out[(k + 1) % out.length];
      if (out.length < 2 || j === i) return true;
      const far = hypot(points[j][0] - points[i][0], points[j][1] - points[i][1]);
      return far > reach * 0.75 || turn[i] >= turn[j];
    });
  };

  // A closed polyline as a path of anchor points: corners where it turns sharply, curves in
  // between that stay within `tolerance` of it. `forced`: indices that are corners whatever.
  const fitLoop = (points, { tolerance = 0.6, reach = 4, angle = 0.8, forced = null } = {}) => {
    const n = points.length;
    if (n < 3) return null;
    let corners = cornersOf(points, reach, angle);
    if (forced && forced.length) corners = Array.from(new Set(corners.concat(forced))).sort((a, b) => a - b);
    const error = tolerance * tolerance;
    const curves = [];
    // The curves that start at a corner
    const cornerStarts = new Set();
    const smoothStart = !corners.length;
    if (smoothStart) {
      // No corner: from its leftmost point round to it again, smoothly through it
      let start = 0;
      for (let i = 1; i < n; i++) if (points[i][0] < points[start][0]) start = i;
      const run = points.slice(start).concat(points.slice(0, start + 1));
      const centre = unit(sub(run[run.length - 2], run[1]));
      fitCubic(run, 0, run.length - 1, mul(centre, -1), centre, error, curves);
    } else {
      for (let k = 0; k < corners.length; k++) {
        const a = corners[k];
        const b = corners[(k + 1) % corners.length];
        const run = [];
        for (let i = a; ; i = (i + 1) % n) {
          run.push(points[i]);
          if (i === b && run.length > 1) break;
          if (run.length > n + 1) break;
        }
        if (run.length < 2) continue;
        cornerStarts.add(curves.length);
        fitCubic(run, 0, run.length - 1, runTangent(run, 1, reach), runTangent(run, -1, reach), error, curves);
      }
    }
    if (!curves.length) return null;
    // Anchors where curves meet: smooth inside a run, corners between runs
    const contour = curves.map((bez, k) => {
      const previous = curves[(k - 1 + curves.length) % curves.length];
      const smooth = cornerStarts.has(k) ? 0 : 1;
      return [bez[0][0], bez[0][1], previous[2][0], previous[2][1], bez[1][0], bez[1][1], smooth];
    });
    return straighten(contour);
  };

  // A curve that is a line in all but name loses its handles, as Photoshop's lines have none
  const straighten = (contour, slack = 0.35) => {
    const n = contour.length;
    const flat = (a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = hypot(dx, dy);
      if (length < 1e-9) return true;
      const off = (px, py) => {
        const t = ((px - a[0]) * dx + (py - a[1]) * dy) / (length * length);
        if (t < -0.05 || t > 1.05) return Infinity;
        return Math.abs((px - a[0]) * dy - (py - a[1]) * dx) / length;
      };
      return off(a[4], a[5]) < slack && off(b[2], b[3]) < slack;
    };
    const lines = contour.map((point, i) => flat(point, contour[(i + 1) % n]));
    return contour.map((point, i) => {
      const out = point.slice();
      const before = lines[(i - 1 + n) % n];
      const after = lines[i];
      if (after) {
        out[4] = out[0];
        out[5] = out[1];
      }
      if (before) {
        out[2] = out[0];
        out[3] = out[1];
      }
      if (before && after) out[6] = 0;
      return out;
    });
  };

  // A picture's alpha traced and fitted: contours in pixels of the picture
  const trace = (alpha, w, h, options = {}) => {
    const loops = traceEdges(alpha, w, h, options.iso || 128).filter((loop) => Math.abs(areaOf(loop)) >= (options.speck || 3));
    // Outer edges one way round, holes the other: so many loops around it, a hole
    const depth = loops.map((loop, k) => loops.reduce((count, other, j) => count + (j !== k && insideLoop(other, loop[0], loop[1]) ? 1 : 0), 0));
    const contours = [];
    loops.forEach((loop, k) => {
      const outer = depth[k] % 2 === 0;
      const area = areaOf(loop);
      const points = [];
      for (let i = 0; i < loop.length; i += 2) points.push([loop[i], loop[i + 1]]);
      if ((area > 0) !== outer) points.reverse();
      const contour = fitLoop(points, options);
      if (contour && contour.length >= 2) contours.push(contour);
    });
    return contours;
  };

  /* ------------------------------ the paths' geometry ------------------------------ */

  // Segment i of a contour: from point i to the next, as four points
  const segmentOf = (contour, i) => {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    return [[a[0], a[1]], [a[4], a[5]], [b[2], b[3]], [b[0], b[1]]];
  };
  const isLine = (contour, i) => {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    return a[4] === a[0] && a[5] === a[1] && b[2] === b[0] && b[3] === b[1];
  };
  // Every point of every contour moved by f(x, y) → [x, y]
  const mapped = (contours, f) => contours.map((contour) => contour.map((p) => {
    const [x, y] = f(p[0], p[1]);
    const [ix, iy] = f(p[2], p[3]);
    const [ox, oy] = f(p[4], p[5]);
    return [x, y, ix, iy, ox, oy, p[6]];
  }));
  // Points along every contour, `steps` per curve (a line needs none between)
  const flatten = (contours, steps = 12) => contours.map((contour) => {
    const out = [];
    contour.forEach((point, i) => {
      if (isLine(contour, i)) {
        out.push([point[0], point[1]]);
        return;
      }
      const bez = segmentOf(contour, i);
      for (let k = 0; k < steps; k++) out.push(bezierAt(bez, k / steps));
    });
    return out;
  });
  const boundsOf = (contours) => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    flatten(contours, 16).forEach((points) => points.forEach(([x, y]) => {
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }));
    return { left, top, right, bottom };
  };
  // The point of the contours nearest to (x, y): which curve, how far along, how far away
  const nearest = (contours, x, y) => {
    let best = null;
    contours.forEach((contour, c) => {
      contour.forEach((point, i) => {
        const bez = segmentOf(contour, i);
        let bt = 0;
        let bd = Infinity;
        for (let k = 0; k <= 24; k++) {
          const p = bezierAt(bez, k / 24);
          const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
          if (d < bd) {
            bd = d;
            bt = k / 24;
          }
        }
        // Closer, halving the step
        let step = 1 / 24;
        for (let k = 0; k < 10; k++) {
          step /= 2;
          [bt - step, bt + step].forEach((t) => {
            if (t < 0 || t > 1) return;
            const p = bezierAt(bez, t);
            const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
            if (d < bd) {
              bd = d;
              bt = t;
            }
          });
        }
        if (!best || bd < best.d2) {
          const p = bezierAt(bez, bt);
          best = { c, i, t: bt, x: p[0], y: p[1], d2: bd };
        }
      });
    });
    if (best) best.distance = Math.sqrt(best.d2);
    return best;
  };
  const copy = (contours) => contours.map((contour) => contour.map((point) => point.slice()));
  // A new anchor on curve i of contour c, at t: the curve cut in two, its shape kept
  const split = (contours, c, i, t) => {
    const out = copy(contours);
    const contour = out[c];
    const j = (i + 1) % contour.length;
    const line = isLine(contour, i);
    const [p0, p1, p2, p3] = segmentOf(contour, i);
    const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = lerp(p0, p1);
    const b = lerp(p1, p2);
    const e = lerp(p2, p3);
    const ab = lerp(a, b);
    const be = lerp(b, e);
    const m = lerp(ab, be);
    if (line) {
      contour.splice(i + 1, 0, [m[0], m[1], m[0], m[1], m[0], m[1], 0]);
      return { contours: out, index: i + 1 };
    }
    contour[i][4] = a[0];
    contour[i][5] = a[1];
    contour[j][2] = e[0];
    contour[j][3] = e[1];
    contour.splice(i + 1, 0, [m[0], m[1], ab[0], ab[1], be[0], be[1], 1]);
    return { contours: out, index: i + 1 };
  };
  // An anchor taken away: the curves on either side become one that follows them as well as
  // one curve can, leaving and arriving as they did
  const remove = (contours, c, i) => {
    const out = copy(contours);
    const contour = out[c];
    if (contour.length <= 2) {
      out.splice(c, 1);
      return out;
    }
    const n = contour.length;
    const h = (i - 1 + n) % n;
    const j = (i + 1) % n;
    const points = [];
    [segmentOf(contour, h), segmentOf(contour, i)].forEach((bez, k) => {
      for (let s = k ? 1 : 0; s <= 16; s++) points.push(bezierAt(bez, s / 16));
    });
    const before = contour[h];
    const after = contour[j];
    const t1 = unit([before[4] - before[0], before[5] - before[1]]);
    const t2 = unit([after[2] - after[0], after[3] - after[1]]);
    const first = unit(sub(points[1], points[0]));
    const last = unit(sub(points[points.length - 2], points[points.length - 1]));
    const bez = generateBezier(points, 0, points.length - 1, chordParameters(points, 0, points.length - 1), t1[0] || t1[1] ? t1 : first, t2[0] || t2[1] ? t2 : last);
    const bothLines = isLine(contour, h) && isLine(contour, i);
    before[4] = bothLines ? before[0] : bez[1][0];
    before[5] = bothLines ? before[1] : bez[1][1];
    after[2] = bothLines ? after[0] : bez[2][0];
    after[3] = bothLines ? after[1] : bez[2][1];
    contour.splice(i, 1);
    return out;
  };
  // An anchor made smooth: its handles in line, along the way from the anchor before to the
  // one after, each a third of the way to its neighbour. Or made a corner: no handles at all.
  const smoothen = (contour, i) => {
    const n = contour.length;
    const p = contour[i];
    const a = contour[(i - 1 + n) % n];
    const b = contour[(i + 1) % n];
    const t = unit([b[0] - a[0], b[1] - a[1]]);
    const back = hypot(p[0] - a[0], p[1] - a[1]) / 3;
    const ahead = hypot(b[0] - p[0], b[1] - p[1]) / 3;
    return [p[0], p[1], p[0] - t[0] * back, p[1] - t[1] * back, p[0] + t[0] * ahead, p[1] + t[1] * ahead, 1];
  };
  const sharpen = (point) => [point[0], point[1], point[0], point[1], point[0], point[1], 0];
  // A smooth anchor's other handle, turned to stay in line with the one just moved (`side`:
  // "in" or "out"), at its own length
  const alignHandles = (point, side) => {
    const out = point.slice();
    const [hx, hy] = side === "in" ? [point[2], point[3]] : [point[4], point[5]];
    const [ox, oy] = side === "in" ? [point[4], point[5]] : [point[2], point[3]];
    const length = hypot(ox - point[0], oy - point[1]);
    const d = unit([point[0] - hx, point[1] - hy]);
    if (!(d[0] || d[1]) || length < 1e-9) return out;
    if (side === "in") {
      out[4] = point[0] + d[0] * length;
      out[5] = point[1] + d[1] * length;
    } else {
      out[2] = point[0] + d[0] * length;
      out[3] = point[1] + d[1] * length;
    }
    return out;
  };
  // Curve i of contour c bent so that its point at t goes by (dx, dy): its two handles moved,
  // the one nearer to that point more (Photoshop's drag on a curve)
  const bend = (contours, c, i, t, dx, dy) => {
    const out = copy(contours);
    const contour = out[c];
    const j = (i + 1) % contour.length;
    const s = Math.max(0.08, Math.min(0.92, t));
    const r = 1 - s;
    const k = 3 * r * s * (r * r + s * s);
    const wa = r / k;
    const wb = s / k;
    contour[i][4] += dx * wa;
    contour[i][5] += dy * wa;
    contour[j][2] += dx * wb;
    contour[j][3] += dy * wb;
    // Smooth anchors keep their handles in line
    if (contour[i][6]) contour[i] = alignHandles(contour[i], "out");
    if (contour[j][6]) contour[j] = alignHandles(contour[j], "in");
    return out;
  };
  // Long curves cut until none is longer than `most`, so that a brush finds points on them.
  // `only(bez)`: just the curves it says yes to.
  const densify = (contours, most, only = null) => {
    let out = copy(contours);
    out.forEach((contour, c) => {
      for (let i = 0; i < out[c].length; i++) {
        const bez = segmentOf(out[c], i);
        if (only && !only(bez)) continue;
        let length = 0;
        let q = bez[0];
        for (let k = 1; k <= 8; k++) {
          const p = bezierAt(bez, k / 8);
          length += hypot(p[0] - q[0], p[1] - q[1]);
          q = p;
        }
        if (length > most) {
          const pieces = Math.min(16, Math.ceil(length / most));
          // Cut at 1/pieces, then the rest again from there
          out = split(out, c, i, 1 / pieces).contours;
        }
      }
    });
    return out;
  };
  // Fewer anchors: the outline followed finely, then fitted again more loosely, its corners kept
  const simplify = (contours, tolerance, options = {}) => contours.map((contour) => {
    const points = [];
    const forced = [];
    contour.forEach((point, i) => {
      if (!point[6]) forced.push(points.length);
      const bez = segmentOf(contour, i);
      const steps = isLine(contour, i) ? Math.max(2, Math.ceil(hypot(bez[3][0] - bez[0][0], bez[3][1] - bez[0][1]) / Math.max(0.5, tolerance))) : 24;
      for (let k = 0; k < steps; k++) points.push(bezierAt(bez, k / steps));
    });
    return fitLoop(points, Object.assign({ tolerance, forced: options.keepCorners === false ? null : forced }, options)) || contour;
  }).filter((contour) => contour && contour.length >= 2);
  // As an SVG path: M, C, Z
  const svgPath = (contours, f = (x, y) => [x, y]) => contours.map((contour) => {
    let d = "";
    contour.forEach((point, i) => {
      const [x, y] = f(point[0], point[1]);
      if (!i) d += `M${x.toFixed(2)},${y.toFixed(2)}`;
      const next = contour[(i + 1) % contour.length];
      const [ax, ay] = f(point[4], point[5]);
      const [bx, by] = f(next[2], next[3]);
      const [nx, ny] = f(next[0], next[1]);
      d += `C${ax.toFixed(2)},${ay.toFixed(2)} ${bx.toFixed(2)},${by.toFixed(2)} ${nx.toFixed(2)},${ny.toFixed(2)}`;
    });
    return d + "Z";
  }).join("");
  // Onto a canvas's path, through f
  const toPath = (ctx, contours, f = (x, y) => [x, y]) => {
    contours.forEach((contour) => {
      contour.forEach((point, i) => {
        const [x, y] = f(point[0], point[1]);
        if (!i) ctx.moveTo(x, y);
        const next = contour[(i + 1) % contour.length];
        const [ax, ay] = f(point[4], point[5]);
        const [bx, by] = f(next[2], next[3]);
        const [nx, ny] = f(next[0], next[1]);
        ctx.bezierCurveTo(ax, ay, bx, by, nx, ny);
      });
      ctx.closePath();
    });
  };
  // Whether (x, y) is in the filled shape (nonzero), from its outline followed finely
  const contains = (contours, x, y) => {
    let winding = 0;
    flatten(contours, 10).forEach((points) => {
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yj <= y) {
          if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) winding++;
        } else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) winding--;
      }
    });
    return winding !== 0;
  };
  const valid = (outline) => Boolean(outline) && Array.isArray(outline.c) && outline.c.length > 0 && outline.c.length <= 200
    && outline.c.every((contour) => Array.isArray(contour) && contour.length >= 2 && contour.length <= 4000 && contour.every((p) => Array.isArray(p) && p.length >= 6 && p.slice(0, 6).every(Number.isFinite)));

  window.TypeROutline = { trace, traceEdges, fitLoop, segmentOf, isLine, mapped, flatten, boundsOf, nearest, split, remove, smoothen, sharpen, alignHandles, bend, densify, simplify, svgPath, toPath, contains, copy, valid, bezierAt };
})();
