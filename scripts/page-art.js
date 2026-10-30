// Draws the demo's manga page: original art, screentone and ink only, no
// characters, no generative model. Runs in a browser (scripts/build-page.mjs)
// and leaves window.pageArt = { width, height, bubbles }.
(function () {
  const W = 1400;
  const H = 1820;
  const INK = "#0b0b0b";
  const SCALE = window.PAGE_SCALE || 1;
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  // Repeatable randomness: the same page every build
  let seed = 20261030;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const panel = (x, y, w, h, draw) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    draw(x, y, w, h);
    ctx.restore();
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.strokeRect(x, y, w, h);
  };

  // Screentone: dots whose size follows density(px, py) in 0..1
  const tone = (x, y, w, h, pitch, density, angle = 0.5236) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const reach = Math.hypot(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = INK;
    for (let v = -reach; v < reach; v += pitch) {
      for (let u = -reach; u < reach; u += pitch) {
        const px = cx + u * cos - v * sin;
        const py = cy + u * sin + v * cos;
        if (px < x - pitch || px > x + w + pitch || py < y - pitch || py > y + h + pitch) continue;
        const d = density(px, py);
        if (d <= 0.01) continue;
        const r = Math.min(pitch * 0.72, pitch * 0.72 * Math.sqrt(d));
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const wedge = (cx, cy, angle, spread, inner, outer) => {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle - spread) * outer, cy + Math.sin(angle - spread) * outer);
    ctx.lineTo(cx + Math.cos(angle + spread) * outer, cy + Math.sin(angle + spread) * outer);
    ctx.closePath();
    ctx.fill();
  };

  const focusLines = (cx, cy, inner, outer, count) => {
    ctx.fillStyle = INK;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rnd() * 0.02;
      const start = inner * (0.86 + rnd() * 0.5);
      wedge(cx, cy, angle, 0.0018 + rnd() * 0.0085, start, outer);
    }
  };

  const speedLines = (x, y, w, h, count) => {
    ctx.fillStyle = INK;
    for (let i = 0; i < count; i++) {
      const ly = y + rnd() * h;
      const thick = 1 + rnd() * rnd() * 7;
      const len = w * (0.3 + rnd() * 0.75);
      const from = rnd() < 0.5 ? x - 20 : x + w - len + 20;
      ctx.beginPath();
      ctx.moveTo(from, ly);
      ctx.lineTo(from + len, ly - thick / 2);
      ctx.lineTo(from + len, ly + thick / 2);
      ctx.closePath();
      ctx.fill();
    }
  };

  const skyline = (x, base, w, minH, maxH, gap, lit) => {
    let cursor = x - 20;
    while (cursor < x + w) {
      const bw = 34 + rnd() * 92;
      const bh = minH + rnd() * (maxH - minH);
      ctx.fillStyle = INK;
      ctx.fillRect(cursor, base - bh, bw, bh + 300);
      if (rnd() < 0.35) ctx.fillRect(cursor + bw * 0.35, base - bh - 26, 5, 26);
      for (let wy = base - bh + 12; wy < base - 8; wy += 17) {
        for (let wx = cursor + 8; wx < cursor + bw - 10; wx += 13) {
          if (rnd() < lit) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
      cursor += bw + gap * rnd();
    }
  };

  const utilityPole = (x, top, bottom, scale) => {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 9 * scale, top, 18 * scale, bottom - top);
    [0.05, 0.12, 0.2].forEach((at, i) => {
      const y = top + (bottom - top) * at;
      const half = (88 - i * 16) * scale;
      ctx.fillRect(x - half, y, half * 2, 8 * scale);
      for (let k = -1; k <= 1; k += 2) {
        ctx.fillRect(x + k * half - 3 * scale, y - 16 * scale, 7 * scale, 17 * scale);
      }
    });
    ctx.fillRect(x + 12 * scale, top + (bottom - top) * 0.3, 48 * scale, 60 * scale);
  };

  const wire = (x1, y1, x2, y2, sag, width = 2.2) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
    ctx.stroke();
  };

  /* ============================ bubbles ============================ */

  const bubbles = [];
  const ellipsePath = (cx, cy, rx, ry, path = new Path2D()) => {
    path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    return path;
  };

  const inkBubble = (paths, fill = "#fff", lineWidth = 6) => {
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = lineWidth;
    paths.forEach((p) => ctx.stroke(p));
    ctx.fillStyle = fill;
    paths.forEach((p) => ctx.fill(p));
  };

  const tailPath = (cx, cy, rx, ry, angle, width, tipX, tipY) => {
    const a = angle - width;
    const b = angle + width;
    const p = new Path2D();
    p.moveTo(cx + Math.cos(a) * rx * 0.97, cy + Math.sin(a) * ry * 0.97);
    p.quadraticCurveTo(cx + Math.cos(angle) * rx * 1.08, cy + Math.sin(angle) * ry * 1.08, tipX, tipY);
    p.quadraticCurveTo(cx + Math.cos(angle) * rx * 1.04, cy + Math.sin(angle) * ry * 1.04, cx + Math.cos(b) * rx * 0.97, cy + Math.sin(b) * ry * 0.97);
    p.closePath();
    return p;
  };

  const oval = (id, cx, cy, rx, ry, tail, options = {}) => {
    const paths = [ellipsePath(cx, cy, rx, ry)];
    if (tail) paths.push(tailPath(cx, cy, rx, ry, tail.angle, tail.width || 0.13, tail.x, tail.y));
    inkBubble(paths, options.fill || "#fff");
    bubbles.push({ id, x: cx, y: cy, rx, ry, kind: options.kind || "oval" });
  };

  const spiky = (id, cx, cy, rx, ry, spikes) => {
    const p = new Path2D();
    for (let i = 0; i < spikes * 2; i++) {
      const t = (i / (spikes * 2)) * Math.PI * 2 + 0.2;
      const out = i % 2 === 0;
      const jitter = out ? 0.94 + rnd() * 0.14 : 0.72 + rnd() * 0.05;
      const x = cx + Math.cos(t) * rx * jitter;
      const y = cy + Math.sin(t) * ry * jitter;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    inkBubble([p]);
    bubbles.push({ id, x: cx, y: cy, rx, ry, kind: "shout" });
  };

  const caption = (id, x, y, w, h) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.strokeRect(x, y, w, h);
    bubbles.push({ id, x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2, kind: "box" });
  };

  /* ============================== page ============================== */

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // Top: the outer line at dusk, wires across the sky
  panel(52, 52, 1296, 590, (x, y, w, h) => {
    tone(x, y, w, h, 9, (px, py) => Math.max(0, 0.72 - ((py - y) / h) * 1.05));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + 1100, y + 96, 58, 0, Math.PI * 2);
    ctx.fill();
    skyline(x, y + h - 64, w, 54, 196, 18, 0.17);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y + h - 76, w, 90);
    for (let i = 0; i < 44; i++) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + i * 31 + 6, y + h - 52, 18, 4);
    }
    utilityPole(x + 1190, y - 40, y + h, 1.25);
    utilityPole(x + 96, y + 60, y + h, 0.74);
    [[0, 18], [26, 22], [66, 30], [90, 34]].forEach(([off, sag]) => wire(x + 104, y + 96 + off, x + 1188, y + 28 + off * 1.5, sag));
  });

  // Middle right: the level crossing
  panel(704, 670, 644, 520, (x, y, w, h) => {
    tone(x, y, w, h * 0.62, 8, (px, py) => 0.1 + ((py - y) / h) * 0.32);
    const vx = x + w * 0.26;
    const vy = y + h * 0.54;
    ctx.fillStyle = INK;
    ctx.fillRect(x, vy - 4, w, 8);
    skyline(x, vy, w, 12, 54, 12, 0.08);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, vy, w, h);
    ctx.fillStyle = INK;
    [[-260, -220], [150, 190], [-650, -580], [520, 590]].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(vx - 3, vy);
      ctx.lineTo(x + w * 0.26 + a, y + h);
      ctx.lineTo(x + w * 0.26 + b, y + h);
      ctx.lineTo(vx + 3, vy);
      ctx.closePath();
      ctx.fill();
    });
    for (let i = 1; i < 12; i++) {
      const t = Math.pow(i / 12, 2.1);
      const yy = vy + (h - h * 0.54) * t;
      ctx.fillRect(vx - 330 * t - 40, yy, 620 * t + 80, 3 + 16 * t);
    }
    ctx.fillRect(x + 548, y + 180, 16, h);
    ctx.save();
    ctx.translate(x + 556, y + 230);
    [0.62, -0.62].forEach((r) => {
      ctx.save();
      ctx.rotate(r);
      ctx.fillStyle = INK;
      ctx.fillRect(-72, -13, 144, 26);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-66, -7, 132, 14);
      ctx.fillStyle = INK;
      for (let s = -60; s < 60; s += 26) ctx.fillRect(s, -7, 12, 14);
      ctx.restore();
    });
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fillRect(x + 494, y + 306, 124, 34);
    ctx.fillStyle = "#fff";
    [516, 596].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(x + cx, y + 323, 11, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Middle left: rain, a mid tone so the black bubble stands out
  panel(52, 670, 624, 520, (x, y, w, h) => {
    tone(x, y, w, h, 8, (px, py) => 0.3 + ((py - y) / h) * 0.34);
    skyline(x, y + h * 0.5, w, 30, 110, 10, 0.04);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
    tone(x, y + h * 0.5, w, h * 0.5, 8, (px, py) => 0.62 - ((py - y - h * 0.5) / h) * 0.5);
    ctx.lineCap = "round";
    for (let i = 0; i < 230; i++) {
      const rx = x + rnd() * (w + 160) - 80;
      const ry = y + rnd() * h;
      const len = 26 + rnd() * 70;
      ctx.strokeStyle = rnd() < 0.72 ? "#fff" : INK;
      ctx.lineWidth = 1 + rnd() * 2.2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - len * 0.34, ry + len);
      ctx.stroke();
    }
  });

  // Bottom left: the shock
  panel(52, 1218, 624, 550, (x, y, w, h) => {
    focusLines(x + w * 0.5, y + h * 0.5, 250, 780, 230);
  });

  // Bottom right: the train goes through
  panel(704, 1218, 644, 550, (x, y, w, h) => {
    speedLines(x, y, w, h, 130);
    tone(x, y + h * 0.62, w, h * 0.38, 8, (px, py) => 0.08 + ((py - (y + h * 0.62)) / (h * 0.38)) * 0.55);
  });

  // Bubbles, over the art. Big and small on the wires
  oval("big", 836, 300, 310, 200, { angle: 2.05, x: 690, y: 566 });
  oval("small", 300, 208, 182, 116, { angle: 1.2, x: 372, y: 372 });

  // The crossing
  oval("crossingA", 1040, 842, 178, 112, { angle: 0.5, x: 1236, y: 906 });
  oval("crossingB", 892, 1064, 160, 92, { angle: 2.5, x: 746, y: 1160 });

  // Rain: a caption and the black bubble
  caption("box", 86, 706, 390, 122);
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#fff";
  ctx.stroke(ellipsePath(364, 1010, 244, 146));
  oval("black", 364, 1010, 244, 146, null, { fill: INK, kind: "black" });

  // The shock
  spiky("shout", 364, 1492, 256, 208, 15);

  // The train: a double bubble, and one still lettered in Japanese
  const a = ellipsePath(936, 1364, 178, 112);
  const b = ellipsePath(1146, 1416, 164, 104);
  inkBubble([a, b]);
  bubbles.push({ id: "double", x: 936, y: 1364, rx: 178, ry: 112, kind: "double" });
  bubbles.push({ id: "doubleSecond", x: 1146, y: 1416, rx: 164, ry: 104, kind: "double" });

  oval("lettered", 1034, 1640, 208, 100, null, { kind: "lettered" });
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 44px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';
  ctx.fillText("こんにちは、", 1034, 1612);
  ctx.fillText("元気？", 1034, 1668);

  window.pageArt = { width: W, height: H, bubbles, canvas };
  if (!window.PAGE_SCALE) {
    document.body.appendChild(canvas);
    canvas.style.width = "100%";
  }
})();
