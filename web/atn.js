// Photoshop Actions files (.atn): reads them into plain data, writes that data back byte for
// byte, builds new ones from JS, and knows what the steps a cleaner or a typesetter records
// look like inside. No UI here: the Actions panel, the recorder and the player use this.
//
// THE FILE (all numbers big-endian; "ustring" = u32 count of UTF-16 code units + the units,
// Photoshop always counting and writing a final NUL)
//
//   file   := version u32 (16; 12 for Photoshop 5) , set , [set …]
//             (Photoshop's own Essentials.atn holds seven sets one after the other; a usual
//             file holds one)
//   set    := name ustring, expanded u8, action count u32, actions
//   action := function key u16 (0 none, 1–15 = F1–F15), shift u8, command u8 (Ctrl on
//             Windows), colour u16 (Button Mode: 0 none, 1 red, 2 orange, 3 yellow, 4 green,
//             5 blue, 6 violet, 7 gray), name ustring, expanded u8, item count u32, items
//   item   := expanded u8, enabled u8, with dialog u8, dialog options u8,
//             event: "TEXT" + u32 length + ASCII string id ("gaussianBlur": every file
//                    Photoshop CS and later writes) | "long" + 4-char code ("GsnB": older ones),
//             dictionary name: u32 length + bytes (the step's name in the Actions panel, in
//                    the language and the 8-bit encoding of the Photoshop that recorded it),
//             descriptor flag i32 (-1 a descriptor follows, 0 none), [descriptor]
//
// THE DESCRIPTOR (Adobe's "Descriptor structure", the ActionDescriptor of scripting)
//
//   descriptor := name ustring, class id, item count u32, (key id, value) …
//   id         := u32 length, then length bytes (a string id: "artboardRect") or, when the
//                 length is 0, 4 bytes (a char id: "Rds ")
//   value      := 4-byte type, then the data of that type (see readValue)
//
// In an action, the step's descriptor is named after the step in Unicode ("Gaussian Blur",
// or "Flou gaussien" in French Photoshop) and its class id is the event's char id ("GsnB").
// A version 12 file uses the older layout: bare 4-byte ids, and no name or class at the root
// or in objects (layout as documented by photocraft's atn/legacy.rs, Apache-2.0/MIT; no
// Photoshop-written version 12 file was at hand to check it against).
//
// THE DATA (what parse returns, what write takes; plain objects, JSON-safe, no classes)
//
//   { version: 16, name, expanded, actions: [action], moreSets?: [{ name, expanded, actions }],
//     trailing?: hex }
//   action = { name, index (the function key), shiftKey, commandKey, colorIndex, expanded,
//              items: [item] }
//   item   = { expanded, enabled, withDialog, dialogOptions, eventType: "TEXT" | "long",
//              event: "gaussianBlur" | "GsnB", dictionaryName, descriptor: descriptor | null }
//   descriptor = { name, classId, items: [[key, value], …] }   (stored order, duplicates kept)
//   value  = { type: <the 4-byte type>, … }:
//     doub { value }               UntF { unit: "#Pxl", value }    UnFl { unit, values: [] }
//     long { value }               comp { value (a number, or a decimal string past 2^53) }
//     bool { value }               TEXT { value }                  enum { enumType, value }
//     Objc, GlbO { name, classId, items }  (an object: a descriptor itself)
//     VlLs { values: [value] }     type, GlbC { name, classId }
//     "obj " { refs: [ref] }       alis, "Pth ", tdta { data: hex }
//     ObAr { prefix, name, classId, items } (an object array; its values are UnFl)
//   ref    = { form, name, classId, … } by form: prop { key }, Clss {}, Enmr { enumType,
//            value }, rele { offset }, Idnt { id }, indx { index }, name { value }
//
// Conventions that keep the bytes:
// - Strings are JS strings without the final NUL Photoshop writes. A string stored without
//   it (never seen in a real file) lists its field in the object's `bare` array.
// - Ids are strings: 4 characters = a char id ("Rds "); any other length = a string id
//   ("radius"). A string id that is itself 4 characters long ("warp", "base", "ruby"…) is
//   written "str:warp" (as is any string id starting with "str:").
// - Event names, dictionary names, ids, units and hex blobs hold one character per byte
//   (Latin-1), so a localized dictionary name stays as its bytes ("D\x8efinir" is Mac
//   Roman "Définir"): show label(item), which prefers the descriptor's Unicode name.
// - A double JSON can't hold (NaN, an infinity, -0) keeps its 8 bytes as hex in `bits` (in
//   UnFl, `bits` runs beside `values`, null for the others); a bool byte other than 0 or 1
//   keeps it in `byte`.
//
// THE API (window.TypeRATN; require("./atn.js") in Node)
//
//   parse(arrayBufferOrBytes) → file; write(file) → ArrayBuffer. Errors are AtnError, with
//     the byte where the file went wrong.
//   parseDescriptor(bytes) / writeDescriptor(descriptor) → Uint8Array (a bare descriptor);
//     parseDescriptorAt(bytes, offset) → { descriptor, end }, one followed by other data
//   parsePalette(bytes) / writePalette(palette): Photoshop's "Actions Palette.psp", every set
//     of the user's Actions panel at once ({ version, sets, trailing })
//   Building: file(name, actions, opts), action(name, items, opts), step(event, descriptor or
//     { key: value }, flags), desc(classId, entries, name), the values px, pct, angle, unit,
//     num, int, bool, text, enumv, list, obj, cls, fileAlias, ref (+ refEnum, refProp,
//     refName, refIndex, refOffset, refId, refClass, target); and make.<step>(options), the
//     steps of the catalogue as Photoshop 2026 played them: make.gaussianBlur({ radius: 3 }).
//   Reading: get(d, ...path), getAll(d, key), keyOf(d, key), value(v) (a value as plain JS),
//     pathOf(v) (the file of an alis or Pth value), same(a, b), charId(id), stringId(id),
//     toId(name) (the TERMS table), eventInfo(item | event), label(item) (the step's name),
//     title(item) ("Select layer “Bg”"), params(item) ([{ key, label, text }]), summary(item)
//     ("Gaussian Blur — Radius: 4.2 px"), words(id), displayName(name) (a "$$$/…=Name" name).
//     Labels and texts are English: the panel translates them.
//   EVENTS: the catalogue of the events typical actions contain, with the shape of their
//     descriptor and what confirms it (see "the events").
//
// What Photoshop 2026 taught (desktop/scripts/test-atn.js --photoshop):
// - A Set of a layer's name with other properties only renames it: make.renameLayer apart.
// - A layer index counts from the bottom, 1 being the lowest layer above the Background.
// - A path must be an alias ('alis'): a 'Pth ' value doesn't resolve, and Photoshop then asks
//   for the place in a dialog. make.save writes a minimal alias (fileAlias).
// - Save Actions can't be scripted: a "save" event naming a set saves the front document.

(function (root) {
  "use strict";

  const VERSION = 16;
  const LEGACY_VERSION = 12;
  // Bounds a damaged file can't push past: nesting, and counts against the bytes left
  const MAX_DEPTH = 64;

  /* ------------------------------- the bytes ------------------------------- */

  class AtnError extends Error {}
  const fail = (message, at) => {
    throw new AtnError(at === undefined ? message : `${message} (at byte ${at})`);
  };

  const latin1 = (bytes, from, to) => {
    let out = "";
    for (let i = from; i < to; i += 8192) out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(to, i + 8192)));
    return out;
  };
  const HEX = Array.from({ length: 256 }, (_, n) => n.toString(16).padStart(2, "0"));
  const toHex = (bytes) => {
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i]];
    return out;
  };
  const fromHex = (hex) => {
    if (typeof hex !== "string" || hex.length % 2 || /[^0-9a-f]/i.test(hex)) fail("Binary data must be a hex string.");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  };

  const reader = (bytes) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const r = {
      bytes,
      at: 0,
      left: () => bytes.length - r.at,
      need(n, what) {
        if (n > bytes.length - r.at) fail(`The Actions file is cut short: ${what} needs ${n} bytes, ${bytes.length - r.at} left`, r.at);
      },
      // A count read from the file, each element taking at least `least` bytes
      count(least, what) {
        const n = r.u32(what);
        if (n * least > bytes.length - r.at) fail(`The Actions file is damaged: ${n} ${what} can't fit in the ${bytes.length - r.at} bytes left`, r.at - 4);
        return n;
      },
      u8(what = "a flag") {
        r.need(1, what);
        return bytes[r.at++];
      },
      u16(what = "a number") {
        r.need(2, what);
        r.at += 2;
        return view.getUint16(r.at - 2);
      },
      u32(what = "a number") {
        r.need(4, what);
        r.at += 4;
        return view.getUint32(r.at - 4);
      },
      i32(what = "a number") {
        r.need(4, what);
        r.at += 4;
        return view.getInt32(r.at - 4);
      },
      f64(what = "a number") {
        r.need(8, what);
        r.at += 8;
        return view.getFloat64(r.at - 8);
      },
      raw(n, what = "data") {
        r.need(n, what);
        r.at += n;
        return bytes.subarray(r.at - n, r.at);
      },
      code(what = "a 4-character code") {
        r.need(4, what);
        r.at += 4;
        return latin1(bytes, r.at - 4, r.at);
      },
      bytesText(what = "a name") {
        const n = r.u32(what);
        r.need(n, what);
        r.at += n;
        return latin1(bytes, r.at - n, r.at);
      },
    };
    return r;
  };

  const writer = () => {
    let bytes = new Uint8Array(4096);
    let view = new DataView(bytes.buffer);
    let at = 0;
    const room = (n) => {
      if (at + n <= bytes.length) return;
      let size = bytes.length * 2;
      while (size < at + n) size *= 2;
      const grown = new Uint8Array(size);
      grown.set(bytes.subarray(0, at));
      bytes = grown;
      view = new DataView(bytes.buffer);
    };
    const w = {
      u8(v) {
        room(1);
        bytes[at++] = v;
      },
      u16(v) {
        room(2);
        view.setUint16(at, v);
        at += 2;
      },
      u32(v) {
        room(4);
        view.setUint32(at, v);
        at += 4;
      },
      i32(v) {
        room(4);
        view.setInt32(at, v);
        at += 4;
      },
      f64(v) {
        room(8);
        view.setFloat64(at, v);
        at += 8;
      },
      raw(data) {
        room(data.length);
        bytes.set(data, at);
        at += data.length;
      },
      // One byte per character: codes, ids, event and dictionary names
      latin(text, what) {
        room(text.length);
        for (let i = 0; i < text.length; i++) {
          const c = text.charCodeAt(i);
          if (c > 0xff) fail(`${what} "${text}" has a character that doesn't fit in one byte`);
          bytes[at++] = c;
        }
      },
      done: () => bytes.slice(0, at),
    };
    return w;
  };

  /* ------------------------------ strings, ids ------------------------------ */

  // A Unicode string, without the final NUL; `bare` collects the fields stored without one
  const readText = (r, owner, field, what) => {
    const n = r.count(2, what);
    const units = r.raw(n * 2, what);
    let text = "";
    for (let i = 0; i < units.length; i += 2) text += String.fromCharCode((units[i] << 8) | units[i + 1]);
    if (text.endsWith("\0")) return text.slice(0, -1);
    (owner.bare || (owner.bare = [])).push(field);
    return text;
  };
  const writeText = (w, owner, field) => {
    const text = owner[field] == null ? "" : String(owner[field]);
    const terminated = !(owner.bare && owner.bare.includes(field));
    w.u32(text.length + (terminated ? 1 : 0));
    for (let i = 0; i < text.length; i++) w.u16(text.charCodeAt(i));
    if (terminated) w.u16(0);
  };

  const STR = "str:";
  // A string id that looks like a char id gets the "str:" mark
  const markString = (text) => (text.length === 4 || text.startsWith(STR) ? STR + text : text);
  const readId = (r, what = "an id") => {
    const n = r.u32(what);
    if (n === 0) return r.code(what);
    r.need(n, what);
    r.at += n;
    return markString(latin1(r.bytes, r.at - n, r.at));
  };
  const writeId = (w, id, what = "An id") => {
    if (typeof id !== "string" || !id) fail(`${what} must be a non-empty string, not ${JSON.stringify(id)}`);
    if (id.length === 4) {
      w.u32(0);
      w.latin(id, what);
      return;
    }
    const text = id.startsWith(STR) ? id.slice(STR.length) : id;
    w.u32(text.length);
    w.latin(text, what);
  };
  const writeCode = (w, code, what) => {
    if (typeof code !== "string" || code.length !== 4) fail(`${what} must be 4 characters, not ${JSON.stringify(code)}`);
    w.latin(code, what);
  };

  /* ------------------------------ descriptors ------------------------------ */

  // The modern layout (version 16)
  const modern = {
    descriptor(r, depth, into = {}) {
      if (depth > MAX_DEPTH) fail("The Actions file nests its descriptors too deep", r.at);
      into.name = readText(r, into, "name", "a descriptor name");
      into.classId = readId(r, "a class id");
      modern.items(r, depth, into);
      return into;
    },
    items(r, depth, into) {
      const n = r.count(9, "descriptor items");
      const items = [];
      for (let i = 0; i < n; i++) {
        const key = readId(r, "a key");
        items.push([key, readValue(r, depth + 1, modern)]);
      }
      into.items = items;
    },
    cls(r, into) {
      into.name = readText(r, into, "name", "a class name");
      into.classId = readId(r, "a class id");
      return into;
    },
    id: readId,
    objectArray(r, depth, into) {
      into.prefix = r.u32("an object array");
      return modern.descriptor(r, depth + 1, into);
    },
    writeDescriptor(w, d, depth) {
      writeText(w, d, "name");
      writeId(w, d.classId, "A class id");
      modern.writeItems(w, d, depth);
    },
    writeItems(w, d, depth) {
      const items = d.items || [];
      if (!Array.isArray(items)) fail(`A descriptor's items must be an array of [key, value] pairs (class ${d.classId})`);
      w.u32(items.length);
      for (const pair of items) {
        if (!Array.isArray(pair) || pair.length !== 2) fail(`A descriptor item must be a [key, value] pair (class ${d.classId})`);
        writeId(w, pair[0], "A key");
        writeValue(w, pair[1], depth + 1, modern);
      }
    },
    writeClass(w, c) {
      writeText(w, c, "name");
      writeId(w, c.classId, "A class id");
    },
    writeId,
    writeObjectArray(w, v, depth) {
      w.u32(v.prefix >>> 0);
      modern.writeDescriptor(w, v, depth + 1);
    },
  };

  // The version 12 layout: bare 4-byte ids, no names, no class at the root
  const legacy = {
    descriptor(r, depth, into = {}) {
      if (depth > MAX_DEPTH) fail("The Actions file nests its descriptors too deep", r.at);
      into.name = "";
      into.classId = "null";
      legacy.items(r, depth, into);
      return into;
    },
    items(r, depth, into) {
      const n = r.count(8, "descriptor items");
      const items = [];
      for (let i = 0; i < n; i++) {
        const key = r.code("a key");
        items.push([key, readValue(r, depth + 1, legacy)]);
      }
      into.items = items;
    },
    object(r, depth, into) {
      into.name = "";
      into.classId = r.code("a class id");
      legacy.items(r, depth + 1, into);
      return into;
    },
    cls(r, into) {
      into.name = "";
      into.classId = r.code("a class id");
      return into;
    },
    id: (r, what) => r.code(what),
    objectArray(r, depth, into) {
      into.name = "";
      into.classId = r.code("a class id");
      into.prefix = r.u32("an object array");
      legacy.items(r, depth + 1, into);
      return into;
    },
    writeDescriptor(w, d, depth) {
      legacy.writeItems(w, d, depth);
    },
    writeItems(w, d, depth) {
      const items = d.items || [];
      w.u32(items.length);
      for (const [key, value] of items) {
        writeCode(w, key, "A key of a version 12 file");
        writeValue(w, value, depth + 1, legacy);
      }
    },
    writeObject(w, d, depth) {
      writeCode(w, d.classId, "A class id of a version 12 file");
      legacy.writeItems(w, d, depth + 1);
    },
    writeClass(w, c) {
      writeCode(w, c.classId, "A class id of a version 12 file");
    },
    writeId: (w, id, what) => writeCode(w, id, what),
    writeObjectArray(w, v, depth) {
      writeCode(w, v.classId, "A class id of a version 12 file");
      w.u32(v.prefix >>> 0);
      legacy.writeItems(w, v, depth + 1);
    },
  };

  const REF_FORMS = ["prop", "Clss", "Enmr", "rele", "Idnt", "indx", "name"];

  const readValue = (r, depth, layout) => {
    if (depth > MAX_DEPTH) fail("The Actions file nests its descriptors too deep", r.at);
    const at = r.at;
    const type = r.code("a value type");
    const v = { type };
    switch (type) {
      case "obj ": {
        const n = r.count(8, "reference parts");
        v.refs = [];
        for (let i = 0; i < n; i++) {
          const ref = { form: r.code("a reference form") };
          layout.cls(r, ref);
          switch (ref.form) {
            case "prop":
              ref.key = layout.id(r, "a property key");
              break;
            case "Clss":
              break;
            case "Enmr":
              ref.enumType = layout.id(r, "an enumeration type");
              ref.value = layout.id(r, "an enumeration value");
              break;
            case "rele":
              ref.offset = r.i32("an offset");
              break;
            case "Idnt":
              ref.id = r.u32("an identifier");
              break;
            case "indx":
              ref.index = r.u32("an index");
              break;
            case "name":
              ref.value = readText(r, ref, "value", "a name");
              break;
            default:
              fail(`The Actions file has an unknown kind of reference, "${ref.form}"`, r.at - 4);
          }
          v.refs.push(ref);
        }
        break;
      }
      case "Objc":
      case "GlbO":
        if (layout === legacy) legacy.object(r, depth, v);
        else modern.descriptor(r, depth + 1, v);
        break;
      case "VlLs": {
        const n = r.count(4, "list items");
        v.values = [];
        for (let i = 0; i < n; i++) v.values.push(readValue(r, depth + 1, layout));
        break;
      }
      case "doub":
        readDouble(r, v);
        break;
      case "UntF":
        v.unit = r.code("a unit");
        readDouble(r, v);
        break;
      case "UnFl": {
        v.unit = r.code("a unit");
        const n = r.count(8, "numbers");
        v.values = [];
        for (let i = 0; i < n; i++) {
          const at = r.at;
          const n = r.f64("a number");
          v.values.push(n);
          if (!plainDouble(n)) (v.bits || (v.bits = new Array(i).fill(null)))[i] = toHex(r.bytes.subarray(at, at + 8));
          else if (v.bits) v.bits[i] = null;
        }
        break;
      }
      case "TEXT":
        v.value = readText(r, v, "value", "a text");
        break;
      case "enum":
        v.enumType = layout.id(r, "an enumeration type");
        v.value = layout.id(r, "an enumeration value");
        break;
      case "long":
        v.value = r.i32("an integer");
        break;
      case "comp": {
        const high = r.i32("a large integer");
        const low = r.u32("a large integer");
        const big = BigInt(high) * 4294967296n + BigInt(low);
        v.value = big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big.toString();
        break;
      }
      case "bool": {
        const b = r.u8("a boolean");
        v.value = b !== 0;
        if (b > 1) v.byte = b;
        break;
      }
      case "type":
      case "GlbC":
        layout.cls(r, v);
        break;
      case "alis":
      case "Pth ":
      case "tdta": {
        const n = r.u32("binary data");
        v.data = toHex(r.raw(n, "binary data"));
        break;
      }
      case "ObAr":
        layout.objectArray(r, depth, v);
        break;
      default:
        fail(`The Actions file has a value of an unknown type, "${type}"`, at);
    }
    return v;
  };

  // JSON keeps neither NaN, the infinities nor -0: those keep their 8 bytes as hex
  const plainDouble = (n) => Number.isFinite(n) && !Object.is(n, -0);
  const readDouble = (r, v) => {
    const at = r.at;
    v.value = r.f64("a number");
    if (!plainDouble(v.value)) v.bits = toHex(r.bytes.subarray(at, at + 8));
  };
  const writeDouble = (w, v) => {
    if (v.bits) w.raw(fromHex(v.bits));
    else w.f64(Number(v.value));
  };

  const writeValue = (w, v, depth, layout) => {
    if (depth > MAX_DEPTH) fail("The descriptor nests too deep");
    if (!v || typeof v !== "object" || typeof v.type !== "string") fail(`A descriptor value must be an object with a type, not ${JSON.stringify(v)}`);
    writeCode(w, v.type, "A value type");
    switch (v.type) {
      case "obj ": {
        const refs = v.refs || [];
        w.u32(refs.length);
        for (const ref of refs) {
          writeCode(w, ref.form, "A reference form");
          layout.writeClass(w, ref);
          switch (ref.form) {
            case "prop":
              layout.writeId(w, ref.key, "A property key");
              break;
            case "Clss":
              break;
            case "Enmr":
              layout.writeId(w, ref.enumType, "An enumeration type");
              layout.writeId(w, ref.value, "An enumeration value");
              break;
            case "rele":
              w.i32(ref.offset | 0);
              break;
            case "Idnt":
              w.u32(ref.id >>> 0);
              break;
            case "indx":
              w.u32(ref.index >>> 0);
              break;
            case "name":
              writeText(w, ref, "value");
              break;
            default:
              fail(`Unknown reference form "${ref.form}" (one of ${REF_FORMS.join(", ")})`);
          }
        }
        break;
      }
      case "Objc":
      case "GlbO":
        if (layout === legacy) legacy.writeObject(w, v, depth);
        else modern.writeDescriptor(w, v, depth + 1);
        break;
      case "VlLs": {
        const values = v.values || [];
        w.u32(values.length);
        for (const item of values) writeValue(w, item, depth + 1, layout);
        break;
      }
      case "doub":
        writeDouble(w, v);
        break;
      case "UntF":
        writeCode(w, v.unit, "A unit");
        writeDouble(w, v);
        break;
      case "UnFl": {
        writeCode(w, v.unit, "A unit");
        const values = v.values || [];
        w.u32(values.length);
        values.forEach((n, i) => {
          if (v.bits && v.bits[i]) w.raw(fromHex(v.bits[i]));
          else w.f64(Number(n));
        });
        break;
      }
      case "TEXT":
        writeText(w, v, "value");
        break;
      case "enum":
        layout.writeId(w, v.enumType, "An enumeration type");
        layout.writeId(w, v.value, "An enumeration value");
        break;
      case "long":
        w.i32(v.value | 0);
        break;
      case "comp": {
        const big = BigInt.asIntN(64, BigInt(v.value));
        w.i32(Number(big >> 32n));
        w.u32(Number(big & 0xffffffffn));
        break;
      }
      case "bool":
        w.u8(v.byte !== undefined ? v.byte : v.value ? 1 : 0);
        break;
      case "type":
      case "GlbC":
        layout.writeClass(w, v);
        break;
      case "alis":
      case "Pth ":
      case "tdta": {
        const data = fromHex(v.data || "");
        w.u32(data.length);
        w.raw(data);
        break;
      }
      case "ObAr":
        layout.writeObjectArray(w, v, depth);
        break;
      default:
        fail(`Unknown value type "${v.type}"`);
    }
  };

  /* -------------------------------- the file -------------------------------- */

  const toBytes = (input) => {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    fail("An Actions file must be an ArrayBuffer or a Uint8Array.");
  };

  const readItem = (r, layout) => {
    const item = {
      expanded: r.u8() !== 0,
      enabled: r.u8() !== 0,
      withDialog: r.u8() !== 0,
      dialogOptions: r.u8("the dialog options"),
    };
    const kindAt = r.at;
    item.eventType = r.code("the event's kind");
    if (item.eventType === "TEXT") item.event = r.bytesText("an event name");
    else if (item.eventType === "long") item.event = r.code("an event code");
    else fail(`The Actions file is damaged: a step's event is neither a name nor a code ("${item.eventType}")`, kindAt);
    item.dictionaryName = r.bytesText("a step name");
    const flagAt = r.at;
    const flag = r.i32("the descriptor flag");
    if (flag === -1) item.descriptor = layout.descriptor(r, 0);
    else if (flag === 0) item.descriptor = null;
    else fail(`The Actions file is damaged: bad descriptor flag ${flag}`, flagAt);
    return item;
  };

  const readSet = (r, layout) => {
    const set = {};
    set.name = readText(r, set, "name", "the set's name");
    set.expanded = r.u8() !== 0;
    // An action takes at least 15 bytes, a step 20
    const n = r.count(15, "actions");
    set.actions = [];
    for (let a = 0; a < n; a++) {
      const action = {
        index: r.u16("a function key"),
        shiftKey: r.u8() !== 0,
        commandKey: r.u8() !== 0,
        colorIndex: r.u16("a colour"),
      };
      action.name = readText(r, action, "name", "an action's name");
      action.expanded = r.u8() !== 0;
      const count = r.count(20, "steps");
      action.items = [];
      for (let i = 0; i < count; i++) action.items.push(readItem(r, layout));
      set.actions.push(action);
    }
    return set;
  };

  // The flags of sets, actions and steps read as booleans: Photoshop writes 0 and 1
  const parse = (input) => {
    const bytes = toBytes(input);
    const r = reader(bytes);
    if (bytes.length < 4) fail("This is not a Photoshop Actions file: it is too short.");
    const version = r.u32();
    if (version !== VERSION && version !== LEGACY_VERSION) {
      fail(`This is not a Photoshop Actions file TypeR can read: version ${version} (Photoshop writes 16, Photoshop 5 wrote 12).`);
    }
    const layout = version === LEGACY_VERSION ? legacy : modern;
    const first = readSet(r, layout);
    const file = Object.assign({ version }, first);
    // More sets may follow (Essentials.atn); bytes that don't read as one are kept as they are
    while (r.left() > 0) {
      const at = r.at;
      let set;
      try {
        set = readSet(r, layout);
      } catch (error) {
        if (!(error instanceof AtnError)) throw error;
        r.at = at;
        file.trailing = toHex(bytes.subarray(at));
        break;
      }
      (file.moreSets || (file.moreSets = [])).push(set);
    }
    return file;
  };

  const flag = (v) => (v ? 1 : 0);
  const writeSet = (w, set, layout) => {
    writeText(w, set, "name");
    w.u8(flag(set.expanded));
    const actions = set.actions || [];
    w.u32(actions.length);
    for (const action of actions) {
      w.u16(action.index | 0);
      w.u8(flag(action.shiftKey));
      w.u8(flag(action.commandKey));
      w.u16(action.colorIndex | 0);
      writeText(w, action, "name");
      w.u8(flag(action.expanded));
      const items = action.items || [];
      w.u32(items.length);
      for (const item of items) {
        w.u8(flag(item.expanded));
        w.u8(flag(item.enabled !== false));
        w.u8(flag(item.withDialog));
        w.u8(item.dialogOptions | 0);
        const eventType = item.eventType || "TEXT";
        writeCode(w, eventType, "An event kind");
        if (eventType === "TEXT") {
          w.u32(String(item.event).length);
          w.latin(String(item.event), "An event name");
        } else if (eventType === "long") writeCode(w, item.event, "An event code");
        else fail(`An event kind is "TEXT" or "long", not "${eventType}"`);
        const dictionary = item.dictionaryName == null ? "" : String(item.dictionaryName);
        w.u32(dictionary.length);
        w.latin(dictionary, "A step name");
        if (item.descriptor) {
          w.i32(-1);
          layout.writeDescriptor(w, item.descriptor, 0);
        } else w.i32(0);
      }
    }
  };

  const write = (file) => {
    if (!file || typeof file !== "object") fail("write needs the data of an Actions file.");
    const version = file.version === undefined ? VERSION : file.version;
    if (version !== VERSION && version !== LEGACY_VERSION) fail(`TypeR writes Actions files of version 16 (or 12), not ${version}.`);
    const layout = version === LEGACY_VERSION ? legacy : modern;
    const w = writer();
    w.u32(version);
    writeSet(w, file, layout);
    for (const set of file.moreSets || []) writeSet(w, set, layout);
    if (file.trailing) w.raw(fromHex(file.trailing));
    const out = w.done();
    return out.buffer;
  };

  // A bare descriptor (modern layout), as in a step: name, class, items
  const parseDescriptor = (input) => {
    const bytes = toBytes(input);
    const r = reader(bytes);
    const d = modern.descriptor(r, 0);
    if (r.left()) fail(`${r.left()} bytes follow the descriptor`, r.at);
    return d;
  };
  // A descriptor inside other data (a Styles file's, asl.js): it and the byte after it
  const parseDescriptorAt = (input, offset = 0) => {
    const r = reader(toBytes(input));
    r.at = offset;
    const descriptor = modern.descriptor(r, 0);
    return { descriptor, end: r.at };
  };
  const writeDescriptor = (d) => {
    const w = writer();
    modern.writeDescriptor(w, d, 0);
    return w.done();
  };

  /* --------------------------- the Actions palette --------------------------- */

  // Photoshop keeps its Actions panel in "Actions Palette.psp", in its settings folder:
  // version 16, a count of sets, then the sets as in an .atn file, then a few bytes of the
  // panel's own state (9 in Photoshop 2026), kept in `trailing`. Reading it brings over every
  // action a user has, without exporting the sets one by one.
  const parsePalette = (input) => {
    const bytes = toBytes(input);
    const r = reader(bytes);
    if (bytes.length < 8) fail("This is not a Photoshop Actions palette: it is too short.");
    const version = r.u32();
    if (version !== VERSION) fail(`This is not a Photoshop Actions palette TypeR can read: version ${version}.`);
    const n = r.count(9, "action sets");
    const sets = [];
    for (let i = 0; i < n; i++) sets.push(readSet(r, modern));
    const palette = { version, sets };
    if (r.left()) palette.trailing = toHex(bytes.subarray(r.at));
    return palette;
  };
  const writePalette = (palette) => {
    const w = writer();
    w.u32(VERSION);
    const sets = (palette && palette.sets) || [];
    w.u32(sets.length);
    for (const set of sets) writeSet(w, set, modern);
    if (palette && palette.trailing) w.raw(fromHex(palette.trailing));
    return w.done().buffer;
  };

  /* ------------------------------- terminology ------------------------------- */

  // Each char id and the string id Photoshop gives it: Photoshop 2026's own answer to
  // typeIDToStringID(charIDToTypeID(c)), for every char id in its preset action files and
  // those of the events below (`node desktop/scripts/test-atn.js --terms` checks the table
  // against a running Photoshop). Photoshop names some ids after another meaning of the same
  // code ("Intr" is interfaceIconFrameDimmed and the interpolation key, "Grn " grain and
  // green, "Cntr" center and contrast, "Pnt " paint and point): KEY_WORDS below gives the
  // name a reader expects.
  const TERMS = {
    "#Ang": "angleUnit", "#Mlm": "millimetersUnit", "#Nne": "noneUnit", "#Pnt": "pointsUnit",
    "#Prc": "percentUnit", "#Pxl": "pixelsUnit", "#Rlt": "distanceUnit", "#Rsl": "densityUnit",
    "ASet": "actionSet", "ASty": "applyStyle", "AccE": "accentedEdges", "Actn": "action", "AdNs": "addNoise", "Add ": "add",
    "AddT": "addTo", "AdjL": "adjustmentLayer", "Adjs": "adjustment", "Al  ": "allEnum",
    "Alg ": "alignmentType", "Algn": "align", "All ": "all", "AmMn": "amplitudeMin",
    "AmMx": "amplitudeMax", "Amnt": "amount", "AnCr": "antiAliasCrisp", "Angl": "angle",
    "Anno": "antiAliasNone", "Annt": "antiAliasType", "AntA": "antiAlias", "AppI": "applyImageEvent",
    "As  ": "as", "At  ": "at", "AtKr": "autoKern", "AuCo": "autoContrast", "Auto": "auto",
    "Axis": "axis", "BESl": "bevelEmbossStyle", "BESs": "bevelEmbossStampStyle", "Back": "back",
    "BanW": "blackAndWhite", "Bcbc": "bicubic", "BckC": "backgroundColor", "Bckg": "background",
    "Bckw": "backwardEnum", "Bl  ": "blue", "BlcI": "blackIntensity", "BlcL": "blackLevel",
    "Blck": "black", "BlnM": "blendMode", "Blnc": "balance", "Blnd": "blendRange", "Blnr": "bilinear",
    "BrdT": "borderThickness", "BrgC": "brightnessEvent", "Brgh": "brightness", "BrsD": "brushDetail",
    "BrsS": "brushSize", "BsRl": "basRelief", "Bsln": "baselineShift", "Btch": "batch",
    "BtmM": "bitmapMode", "Btom": "bottom", "Bwd ": "backward", "By  ": "by", "BytO": "byteOrder",
    "CBrn": "colorBurn", "CDdg": "colorDodge", "CMYC": "CMYKColorClass", "CMYM": "CMYKColorMode",
    "ChFX": "chromeFX", "ChMx": "channelMatrix", "ChnM": "channelMixer", "Chnl": "channel",
    "Chrm": "chrome", "ClSz": "cellSize", "Clcl": "calculation", "Clcn": "calculationType",
    "Clds": "clouds", "Cler": "clearEvent", "Clr ": "color", "ClrB": "colorBalance",
    "ClrI": "colorIndicates", "ClrP": "colorPalette", "ClrR": "colorRange", "Clrm": "colorimetric",
    "Clrs": "colors", "Clrt": "colorStop", "Clry": "colorStopType", "Clrz": "colorize",
    "Cls ": "close", "Cmpr": "compression", "Cmps": "composite", "CnsP": "constrainProportions",
    "Cnst": "constant", "Cntc": "contract", "Cntn": "continue", "Cntr": "center",
    "CnvM": "convertMode", "CnvS": "canvasSize", "CpFX": "copyEffects", "CpTL": "copyToLayer",
    "Cpy ": "copy", "CpyM": "copyMerged", "CrcB": "crackBrightness", "CrcD": "crackDepth",
    "CrcS": "crackSpacing", "CrnH": "currentHistoryState", "Crop": "crop", "Crql": "craquelure",
    "Crv ": "curve", "CrvA": "curvesAdjustment", "Crvs": "curves", "CstS": "customStops",
    "CtTL": "cutToLayer", "Cyn ": "cyan", "Dcmn": "document", "DfnP": "definePattern",
    "Dfrn": "difference", "Dfsn": "diffusion", "Dlt ": "delete", "Dnst": "density",
    "DocI": "documentID", "Dplc": "duplicate", "Dpth": "depth", "DrSh": "dropShadow",
    "DrkS": "darkStrokes", "Drkn": "darken", "DryB": "dryBrush", "Dslv": "dissolve",
    "DstB": "destBlackMin", "DstS": "dustAndScratches", "DstW": "destWhiteMin", "Dstl": "destBlackMax",
    "Dstn": "distance", "Dstr": "distort", "Dstt": "desaturate", "DthA": "ditherAmount",
    "Dthr": "dither", "Dtl ": "detail", "EQlt": "extendedQuality", "EdgB": "edgeBrightness",
    "EdgW": "edgeWidth", "Elps": "ellipse", "EmbP": "embedProfiles", "Embs": "emboss",
    "Encd": "encoding", "Exch": "exchange", "Exct": "exact", "Expn": "expand", "Expr": "export",
    "Exps": "exposure", "FStl": "frameStyle", "FTcs": "freeTransformCenterState", "Fade": "fade",
    "Fl  ": "fill", "FlCn": "fillContents", "FlMd": "fillMode", "FlNt": "fillNeutral", "Flip": "flip",
    "FllD": "fullDocument", "FltI": "flattenImage", "Fltt": "flatten", "FnDt": "fineDots",
    "FndE": "findEdges", "FntN": "fontName", "FntS": "fontStyleName", "FntT": "fontTechnology",
    "FrFX": "frameFX", "FrFl": "frameFill", "FrcC": "forcedColors", "FrgC": "foregroundColor",
    "Frnt": "front", "From": "from", "Frst": "first", "Frwr": "forwardEnum", "FtOn": "fitOnScreen",
    "Fthr": "feather", "Fwd ": "forward", "GFFr": "GIFFormat", "Gd  ": "good",
    "GdMp": "gradientMapClass", "Gls ": "glass", "GlwE": "glowingEdges", "Gmm ": "gamma",
    "Gr50": "gray50", "GrFl": "gradientFill", "GrSp": "grainSpeckle", "GrSr": "grainSprinkles",
    "Grad": "gradient", "GrdF": "gradientForm", "GrdT": "gradientType", "Grdn": "gradientClassEvent",
    "Grn ": "grain", "GrnC": "grainClumped", "Grns": "graininess", "Grnt": "grainType", "Grow": "grow",
    "GrpL": "groupEvent", "Grsc": "grayscale", "Grup": "group", "Gry ": "gray",
    "Grys": "grayscaleMode", "Gsn ": "gaussianDistribution", "GsnB": "gaussianBlur", "H   ": "hue",
    "HSBC": "HSBColorClass", "HStr": "hueSaturation", "Hd  ": "hide", "HghL": "highlightLevels",
    "HghP": "highPass", "HghS": "highlightStrength", "Hght": "height", "HrdL": "hardLight",
    "HrzL": "horizontalLocation", "HrzS": "horizontalScale", "Hrzn": "horizontal",
    "HsSt": "historyStates", "Hst2": "hueSatAdjustmentV2", "HstS": "historyState", "IBMP": "IBMPC",
    "Idnt": "ID", "ImgB": "imageBalance", "ImgS": "imageSize", "In  ": "in",
    "IndC": "indexedColorMode", "Inpt": "input", "InrB": "innerBevel", "InsF": "insetFrame",
    "Insd": "inside", "Inte": "intent", "Intn": "intensity", "Intp": "interpolationType",
    "Intr": "interfaceIconFrameDimmed", "InvT": "invertTexture", "Invr": "invert", "Invs": "inverse",
    "IrGl": "innerGlow", "IrSh": "innerShadow", "JPEG": "JPEG", "JstA": "justifyAll", "Knd ": "kind",
    "Krng": "kerning", "LDBt": "lightDirBottom", "LDTR": "lightDirTopRight", "LPLf": "lightPosLeft",
    "Lald": "localLightingAltitude", "LbCM": "labColorMode", "Lctn": "location", "Ldng": "leading",
    "Left": "left", "Lefx": "layerEffects", "LghD": "lightDirection", "LghI": "lightIntensity",
    "LghP": "lightPosition", "Lghn": "lighten", "Lght": "lightness", "Lmns": "luminosity",
    "Lnk ": "link", "LnkL": "linkedLayerIDs", "Lnkd": "linked", "Lnr ": "linear", "Lst ": "last",
    "Lvl ": "level", "LvlA": "levelsAdjustment", "Lvls": "levels", "LwCs": "lowerCase",
    "Lyr ": "layer", "LyrI": "layerID", "Md  ": "mode", "Mddl": "middle", "Mdm ": "mediumQuality",
    "MdmD": "mediumDots", "Mdn ": "median", "Mdpn": "midpoint", "MdtL": "midtoneLevels",
    "Mgnt": "magenta", "Mk  ": "make", "MkVs": "makeVisible", "Mltp": "multiply",
    "Mn  ": "menuItemClass", "MnIt": "menuItemType", "Mnch": "monochromatic", "Mnm ": "minimum",
    "MpBl": "mapBlack", "Mrg2": "mergeLayersNew", "MrgL": "mergeLayers", "MrgV": "mergeVisible",
    "Mrgd": "merged", "Mrge": "merge", "Msge": "message", "Msk ": "mask", "MskA": "maskedAreas",
    "MskI": "maskIndicator", "Mthd": "method", "MtnB": "motionBlur", "MttC": "matteColor",
    "Mxm ": "maximum", "MztT": "mezzotintType", "Mztn": "mezzotint", "N   ": "no", "NTSC": "NTSC",
    "Nm  ": "name", "NmbG": "numberOfGenerators", "NmbR": "numberOfRipples", "None": "none",
    "Nrml": "normal", "Nrst": "nearestNeighbor", "NtPr": "notePaper", "Nw  ": "new", "Nxt ": "next",
    "Ofst": "offset", "Opct": "opacity", "Opn ": "open", "OrGl": "outerGlow", "Ordn": "ordinal",
    "Ornt": "orientation", "Otpt": "output", "Otsd": "outside", "Ovrl": "overlay",
    "PGAd": "PNGFilterAdaptive", "PGIN": "PNGInterlaceNone", "PGIT": "PNGInterlaceType",
    "PNGF": "PNGFormat", "PNGf": "PNGFilter", "PaFX": "pasteEffects", "PbTl": "paintbrushTool",
    "Pht3": "photoshop35Format", "PhtP": "photoshopPDFFormat", "Plc ": "placeEvent", "Plgn": "polygon",
    "Plr ": "polar", "PlsW": "plasticWrap", "Plst": "plaster", "Plt ": "palette", "Pltf": "platform",
    "Ply ": "play", "Pnch": "pinch", "Pncl": "pencilEraser", "PndR": "pondRipples", "Pnt ": "paint",
    "PntT": "paintType", "Pntl": "pointillize", "PprB": "paperBrightness", "PrBL": "preciseMatte",
    "PrgI": "purgeItem", "Prge": "purge", "Prpr": "property", "PrsL": "preserveLuminosity",
    "PrsT": "preserveTransparency", "Prvs": "previous", "Pstn": "position", "Pstr": "posterization",
    "Ptrn": "pattern", "Pts ": "points", "Pxel": "pixel", "QCSt": "quadCenterState",
    "Qcs6": "QCSSide2", "Qcsa": "QCSAverage", "RGB ": "RGB", "RGBC": "RGBColor",
    "RGBM": "RGBColorMode", "Rctn": "rectangle", "Rd  ": "red", "Rdl ": "radial", "Rds ": "radius",
    "RghP": "roughPastels", "Rght": "right", "Rlf ": "relief", "RlrU": "rulerUnits",
    "Rltv": "relative", "Rnd ": "round", "RndS": "randomSeed", "RplC": "replaceColor",
    "RplS": "rippleSize", "Rple": "ripple", "Rpt ": "repeat", "RptE": "repeatEdgePixels",
    "RrPt": "rulerPoints", "Rset": "reset", "Rslt": "resolution", "RstT": "rasterizeTypeLayer",
    "Rstr": "rasterize", "Rtcl": "reticulation", "Rtt ": "rotate", "Rtte": "rotateEventEnum",
    "RvlA": "revealAll", "RvlS": "revealSelection", "Rvrt": "revert", "SClr": "solidColor",
    "SDLD": "strokeDirLeftDiag", "SDir": "strokeDirection", "Sbtr": "subtract", "Scl ": "scale",
    "SclH": "scaleHorizontal", "SclV": "scaleVertical", "Scln": "scaling", "Scrn": "screen",
    "Scrp": "fontScript", "SfBL": "softMatte", "SftL": "softLight", "Sftn": "softness",
    "ShdL": "shadowLevels", "Shp ": "shape", "ShpC": "shapeCurveType", "Shr ": "shear",
    "ShrE": "sharpenEdges", "ShrP": "shearPoints", "ShrS": "shearSt", "Shw ": "show", "Skew": "skew",
    "SlcC": "selectiveColor", "Sml ": "small", "Smlr": "similar", "Smth": "smoothness",
    "SnpS": "snapshotClass", "SoFi": "solidFill", "Spcn": "spacing", "Sphr": "spherize",
    "SprR": "sprayRadius", "SprS": "separationSetup", "Spt ": "spatter", "Src2": "source2",
    "SrcB": "srcBlackMin", "SrcW": "srcWhiteMin", "Srcl": "srcBlackMax", "Srcm": "srcWhiteMax",
    "StDt": "strokeDetail", "StnG": "stainedGlass", "Stop": "stop", "StrD": "strokeDirectionType",
    "StrL": "strokeLength", "StrP": "strokePressure", "Strk": "stroke", "Strt": "saturation",
    "Styl": "style", "Svng": "saving", "Sz  ": "size", "T   ": "to", "TEXT": "char", "TIFF": "TIFF",
    "TglA": "toggleActionsPalette", "TglI": "toggleInfoPalette", "TglN": "toggleNavigatorPalette",
    "TglO": "toggleOptionsPalette", "Tglc": "toggleColorPalette", "Tgly": "toggleLayersPalette",
    "Thrs": "thresholdClassEvent", "Thsh": "threshold", "Tlrn": "tolerance", "Top ": "top",
    "Trck": "tracking", "Trgt": "targetEnum", "TrnF": "transferFunction", "TrnS": "transferSpec",
    "Trnf": "transform", "Trns": "transparency", "Trsp": "transparencyEnum", "Ttl ": "title",
    "Twrl": "twirl", "TxCa": "texTypeCanvas", "TxLr": "textLayer", "TxSt": "texTypeSandstone",
    "TxTL": "texTypeTinyLens", "Txt ": "textKey", "TxtC": "textClickPoint", "TxtS": "textStyle",
    "TxtT": "textureType", "Txtr": "texture", "Txtt": "textStyleRange", "Txtz": "texturizer",
    "Type": "type", "UndA": "undefinedArea", "Undl": "underline", "Unfr": "uniformDistribution",
    "Ungr": "ungroup", "UnsM": "unsharpMask", "UsMs": "useMask", "Usng": "using",
    "UsrM": "userMaskEnabled", "UsrS": "userStop", "Vl  ": "value", "Vrsn": "version",
    "VrtL": "verticalLocation", "VrtS": "verticalScale", "Vrtc": "vertical", "Vsbl": "visible",
    "WLMn": "wavelengthMin", "WLMx": "wavelengthMax", "Wave": "wave", "Wdth": "width", "Web ": "web",
    "What": "what", "Wht ": "white", "WhtI": "whiteIntensity", "WhtL": "whiteLevel", "With": "with",
    "Wrp ": "wrap", "WrpA": "wrapAround", "WvSn": "waveSine", "Wvtp": "waveType", "Xclu": "exclusion",
    "Ylw ": "yellowColor", "Ys  ": "yes", "YsN ": "yesNo", "ZZTy": "zigZagType", "ZgZg": "zigZag",
    "ZpEn": "zip", "blur": "blur", "bvlD": "bevelDirection", "bvlS": "bevelStyle",
    "bvlT": "bevelTechnique", "cjsp": "javaScriptOptionsClass", "copy": "copyEvent", "cut ": "cut",
    "dkCl": "darkerColor", "dlfx": "disableLayerFX", "ebbl": "bevelEmboss", "enab": "enabled",
    "fsel": "selection", "gagl": "globalLightingAngle", "hMix": "hardMix", "hglC": "highlightColor",
    "hglM": "highlightMode", "hglO": "highlightOpacity", "lLit": "linearLight",
    "lagl": "localLightingAngle", "lbrn": "linearBurn", "lddg": "linearDodge",
    "lfxv": "layerFXVisible", "lgCl": "lighterColor", "move": "move", "null": "null",
    "pLit": "pinLight", "pass": "passThrough", "past": "paste", "save": "save", "sdwC": "shadowColor",
    "sdwM": "shadowMode", "sdwO": "shadowOpacity", "setd": "set", "slct": "select",
    "srgR": "strengthRatio", "srgh": "strength", "uglg": "useGlobalAngle", "vLit": "vividLight"
  };
  // Other string ids Photoshop gives the same id (typeIDToCharID(stringIDToTypeID(s)))
  const ALIASES = { contrast: "Cntr", distribute: "Dstr", distribution: "Dstr", green: "Grn ", interpolation: "Intr", strokeLocation: "StrL", target: "null" };
  // String ids of 4 characters that have no char id: written as strings ("str:warp")
  const STRING_ONLY = new Set(["warp", "list", "time", "base", "kana", "ruby", "tint", "trim", "clio"]);
  const CHAR_OF = {};
  for (const c of Object.keys(TERMS)) CHAR_OF[TERMS[c]] = c;
  Object.assign(CHAR_OF, ALIASES);

  // "Rds " → "radius"; "radius" → "radius"; "str:warp" → "warp"
  const stringId = (id) => {
    if (typeof id !== "string") return "";
    if (id.startsWith(STR)) return id.slice(STR.length);
    if (id.length === 4) return TERMS[id] || id;
    return id;
  };
  // "radius" → "Rds "; "Rds " → "Rds "; "crop" → "Crop"; "" when the id has no char id
  // ("presetKind", "warp"). Four characters are a char id when Photoshop has one so spelled.
  const charId = (id) => {
    if (typeof id !== "string") return "";
    if (id.startsWith(STR)) return CHAR_OF[id.slice(STR.length)] || "";
    if (id.length === 4 && (id in TERMS || !(id in CHAR_OF))) return STRING_ONLY.has(id) ? "" : id;
    return CHAR_OF[id] || "";
  };
  // An id as Photoshop writes it: the char id when there is one, else the string id
  const toId = (name) => {
    if (typeof name !== "string" || !name) fail(`An id must be a non-empty string, not ${JSON.stringify(name)}`);
    if (name.startsWith(STR)) return name;
    return charId(name) || markString(name);
  };
  // Whether two ids name the same thing, whatever their form: same("Rds ", "radius")
  const same = (a, b) => {
    if (a === b) return true;
    if (typeof a !== "string" || typeof b !== "string") return false;
    const ca = charId(a);
    if (ca && ca === charId(b)) return true;
    return stringId(a) === stringId(b);
  };

  /* -------------------------------- reading -------------------------------- */

  const itemsOf = (d) => (d && Array.isArray(d.items) ? d.items : []);
  // The value of a key, whatever the form of either id; more arguments walk down objects
  // (keys) and lists (numbers): get(levels, "Adjs", 0, "Gmm ") or get(d, "adjustment", 0, "gamma")
  const get = (d, ...path) => {
    let at = d;
    for (const step of path) {
      if (!at) return undefined;
      if (typeof step === "number") {
        at = Array.isArray(at.values) ? at.values[step] : undefined;
        continue;
      }
      let found;
      for (const [key, value] of itemsOf(at)) {
        if (same(key, step)) {
          found = value;
          break;
        }
      }
      at = found;
    }
    return at;
  };
  // Every value of a key, for the rare descriptor that repeats one
  const getAll = (d, key) => itemsOf(d).filter(([k]) => same(k, key)).map(([, value]) => value);
  // The key as stored ("Rds " for "radius"), or undefined
  const keyOf = (d, key) => {
    const pair = itemsOf(d).find(([k]) => same(k, key));
    return pair && pair[0];
  };
  // A value as plain JS: numbers (a unit's number without its unit: see v.unit), strings,
  // booleans, the stored id of an enum or a class, arrays for lists, and for an object
  // { _class: its string id, <string id of each key>: … }. References come back as they are.
  const value = (v) => {
    if (!v || typeof v !== "object") return v;
    switch (v.type) {
      case "doub":
      case "UntF":
      case "long":
      case "comp":
      case "bool":
      case "TEXT":
      case "enum":
        return v.value;
      case "UnFl":
        return v.values.slice();
      case "VlLs":
        return v.values.map(value);
      case "type":
      case "GlbC":
        return v.classId;
      case "Objc":
      case "GlbO": {
        const out = { _class: stringId(v.classId) };
        for (const [key, item] of itemsOf(v)) out[stringId(key)] = value(item);
        return out;
      }
      case "obj ":
        return v.refs;
      default:
        return v;
    }
  };

  // The path a step saves to or opens: a 'Pth ' value, or the Mac alias Photoshop writes
  // ('alis': an alias record whose POSIX path is in its extra data, tag 18)
  const pathOf = (v) => {
    if (!v || !v.data) return "";
    const bytes = fromHex(v.data);
    const view = new DataView(bytes.buffer);
    try {
      if (v.type === "Pth " && latin1(bytes, 0, 4) === "txtu") {
        const chars = view.getUint32(8, true);
        let out = "";
        for (let i = 0; i < chars; i++) out += String.fromCharCode(view.getUint16(12 + i * 2, true));
        return out.replace(/\0+$/, "");
      }
      if (v.type === "alis" && view.getUint16(6) === 2) {
        let volume = "/";
        let path = "";
        for (let at = 150; at + 4 <= bytes.length; ) {
          const tag = view.getInt16(at);
          const size = view.getUint16(at + 2);
          if (tag === -1) break;
          const text = new TextDecoder().decode(bytes.subarray(at + 4, at + 4 + size));
          if (tag === 18) path = text;
          if (tag === 19) volume = text;
          at += 4 + size + (size % 2);
        }
        if (path) return (volume === "/" ? "" : volume) + (path.startsWith("/") ? path : "/" + path);
      }
    } catch (error) {
      // A blob this reader doesn't know: no path to show
    }
    return "";
  };

  /* -------------------------------- building -------------------------------- */

  // Values. Ids may be given either way ("Rds " or "radius"): they are written as Photoshop
  // writes them, the char id when there is one.
  const UNITS = { px: "#Pxl", "%": "#Prc", deg: "#Ang", ppi: "#Rsl", pt: "#Pnt", mm: "#Mlm", distance: "#Rlt", none: "#Nne" };
  const number = (n, what) => {
    if (typeof n !== "number" || !Number.isFinite(n)) fail(`${what} needs a number, not ${JSON.stringify(n)}`);
    return n;
  };
  const unit = (u, n) => ({ type: "UntF", unit: UNITS[u] || u, value: number(n, `A value in ${u}`) });
  const px = (n) => unit("#Pxl", n);
  const pct = (n) => unit("#Prc", n);
  const angle = (n) => unit("#Ang", n);
  const num = (n) => ({ type: "doub", value: number(n, "A double") });
  const int = (n) => ({ type: "long", value: Math.round(number(n, "An integer")) | 0 });
  const bool = (b) => ({ type: "bool", value: Boolean(b) });
  const text = (s) => ({ type: "TEXT", value: String(s) });
  const enumv = (enumType, v) => ({ type: "enum", enumType: toId(enumType), value: toId(v) });
  const cls = (classId) => ({ type: "type", name: "", classId: toId(classId) });
  // A JS shorthand as a value: true → bool, "a" → TEXT, 1.5 → doub (use int() for long),
  // [..] → VlLs; value objects pass through
  const toValue = (v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v.type === "string") return v;
    if (typeof v === "boolean") return bool(v);
    if (typeof v === "string") return text(v);
    if (typeof v === "number") return num(v);
    if (Array.isArray(v)) return list(v);
    fail(`Can't turn ${JSON.stringify(v)} into a descriptor value`);
  };
  const list = (values) => ({ type: "VlLs", values: values.map(toValue) });
  // Entries as { key: value } (in order; null and undefined left out) or [[key, value], …]
  const toItems = (entries) => {
    if (!entries) return [];
    const pairs = Array.isArray(entries) ? entries : Object.keys(entries).map((key) => [key, entries[key]]);
    return pairs.filter(([, v]) => v !== undefined && v !== null).map(([key, v]) => [toId(key), toValue(v)]);
  };
  const desc = (classId, entries, name = "") => ({ name, classId: toId(classId), items: toItems(entries) });
  const obj = (classId, entries) => Object.assign({ type: "Objc" }, desc(classId, entries));

  // References, from the thing itself outwards: ref(refProp("Prpr", "Lefx"), target())
  const ref = (...parts) => ({ type: "obj ", refs: parts });
  const refClass = (classId) => ({ form: "Clss", name: "", classId: toId(classId) });
  const refProp = (classId, key) => ({ form: "prop", name: "", classId: toId(classId), key: toId(key) });
  const refEnum = (classId, enumType, v) => ({ form: "Enmr", name: "", classId: toId(classId), enumType: toId(enumType), value: toId(v) });
  const refName = (classId, name) => ({ form: "name", name: "", classId: toId(classId), value: String(name) });
  const refIndex = (classId, index) => ({ form: "indx", name: "", classId: toId(classId), index: index >>> 0 });
  const refId = (classId, id) => ({ form: "Idnt", name: "", classId: toId(classId), id: id >>> 0 });
  const refOffset = (classId, offset) => ({ form: "rele", name: "", classId: toId(classId), offset: offset | 0 });
  // The current layer (or document, channel…): Enmr <class> Ordn Trgt
  const target = (classId = "Lyr ") => refEnum(classId, "Ordn", "Trgt");
  // A file as Photoshop for Mac stores it in a step ('alis'): a version 2 alias record that
  // only holds the POSIX path (extra data tags 18 and 19), which Photoshop 2026 resolves
  // (the alias it writes itself adds the volume, the parent folder and a bookmark). The folder
  // must exist when the step plays.
  const fileAlias = (posixPath) => {
    const utf8 = (s) => new TextEncoder().encode(s);
    const name = utf8(String(posixPath).split("/").pop()).subarray(0, 63);
    const tags = [
      [18, utf8(String(posixPath).replace(/^\/+/, ""))],
      [19, utf8("/")],
    ];
    const size = 150 + tags.reduce((n, [, data]) => n + 4 + data.length + (data.length % 2), 0) + 4;
    const out = new Uint8Array(size);
    const view = new DataView(out.buffer);
    view.setUint16(4, size);
    view.setUint16(6, 2);
    out[50] = name.length;
    out.set(name, 51);
    view.setUint16(130, 0xffff);
    view.setUint16(132, 0xffff);
    let at = 150;
    for (const [tag, data] of tags) {
      view.setInt16(at, tag);
      view.setUint16(at + 2, data.length);
      out.set(data, at + 4);
      at += 4 + data.length + (data.length % 2);
    }
    view.setInt16(at, -1);
    return { type: "alis", data: toHex(out) };
  };
  // A file path as a 'Pth ' value ('txtu', the size and the count of UTF-16LE units, little-
  // endian, then the units and a NUL), the form ag-psd reads in PSD files. Photoshop for Mac
  // doesn't resolve it in a step: use fileAlias there.
  const filePath = (path) => {
    const units = String(path) + "\0";
    const body = new Uint8Array(12 + units.length * 2);
    const view = new DataView(body.buffer);
    body.set([0x74, 0x78, 0x74, 0x75], 0);
    view.setUint32(4, body.length, true);
    view.setUint32(8, units.length, true);
    for (let i = 0; i < units.length; i++) view.setUint16(12 + i * 2, units.charCodeAt(i), true);
    return { type: "Pth ", data: toHex(body) };
  };

  // Sets, actions and steps. A step's event is written as its string id ("gaussianBlur"), as
  // every Photoshop since CS does; its descriptor is named after the step and its class is the
  // event's char id, as Photoshop records them.
  const ASCII = /^[\x20-\x7e]*$/;
  const step = (event, descriptor, options) => {
    const info = eventInfo(event);
    const id = info ? info.stringId : stringId(event);
    const label = info ? info.label : words(id);
    let d = descriptor;
    if (d && !Array.isArray(d.items)) d = desc(charId(id) || id, d, label);
    return Object.assign(
      {
        expanded: false,
        enabled: true,
        withDialog: false,
        dialogOptions: info && !info.dialog ? 2 : 0,
        // A char id with no known string id goes in as a code
        eventType: id.length === 4 && !(id in TERMS) && !(id in CHAR_OF) && !STRING_ONLY.has(id) ? "long" : "TEXT",
        event: id,
        dictionaryName: ASCII.test(label) ? label : id,
        descriptor: d || null,
      },
      options
    );
  };
  const action = (name, items = [], options) =>
    Object.assign({ name: String(name), index: 0, shiftKey: false, commandKey: false, colorIndex: 0, expanded: false, items }, options);
  const file = (name, actions = [], options) => Object.assign({ version: VERSION, name: String(name), expanded: true, actions }, options);

  /* -------------------------------- the events -------------------------------- */

  // The events the actions of a cleaner or a typesetter hold, by string id (what the file
  // stores). Each one says:
  //   id         its char id ("" when it has none: such events only exist as string ids)
  //   label      its English name in Photoshop's Actions panel
  //   dialog     whether Photoshop offers its dialog toggle (dialogOptions 0, else 2)
  //   confirmed  "file": the shape is the one Photoshop's own action files hold (its presets,
  //              Essentials.atn, a recorded palette); "played": Photoshop 2026 played the step
  //              this module wrote and did what it should (desktop/scripts/test-atn.js
  //              --photoshop); "": id and label only, shape not checked
  //   shape      the descriptor, as "Class{ key: type … }" (keys in stored order, "|" between
  //              the variants, "?" after a key Photoshop leaves out at times)
  //   params     the keys a summary names, with their labels
  // `make` below builds the confirmed shapes from plain options.
  const EVENTS = {};
  const event = (stringId, id, label, dialog, confirmed, shape, params = []) => {
    EVENTS[stringId] = { stringId, id, label, dialog, confirmed, shape, params: params.map(([key, name]) => ({ key, label: name })) };
  };
  const TARGET = "null: ref(Enmr Lyr Ordn.Trgt)";
  // Adjustments and filters
  event("levels", "Lvls", "Levels", true, "file+played",
    "Lvls{ presetKind?: enum presetKindType.presetKindCustom, Adjs: [ Objc LvlA{ Chnl: ref(Enmr Chnl Chnl.Cmps|Rd  |Grn |Bl  ), Inpt?: [long black, long white], Gmm?: doub, Otpt?: [long black, long white] } ] } | { Auto: true } (Auto Levels) | { AuCo: true } (Auto Contrast)",
    [["Adjs", "Adjustment"], ["Auto", "Auto"], ["AuCo", "Auto Contrast"]]);
  event("curves", "Crvs", "Curves", true, "file+played",
    "Crvs{ presetKind?: enum presetKindType.presetKindCustom, Adjs: [ Objc CrvA{ Chnl: ref(Enmr Chnl Chnl.Cmps), Crv: [ Objc Pnt{ Hrzn: doub, Vrtc: doub } … ] } ] }",
    [["Adjs", "Adjustment"]]);
  event("brightnessEvent", "BrgC", "Brightness/Contrast", true, "file+played", "BrgC{ Brgh: long, Cntr: long, useLegacy?: bool }",
    [["Brgh", "Brightness"], ["Cntr", "Contrast"], ["useLegacy", "Use Legacy"]]);
  event("hueSaturation", "HStr", "Hue/Saturation", true, "file+played",
    "HStr{ presetKind?: enum presetKindType.presetKindCustom, Clrz: bool, Adjs: [ Objc Hst2{ H: long, Strt: long, Lght: long } ] }",
    [["Clrz", "Colorize"], ["Adjs", "Adjustment"]]);
  event("thresholdClassEvent", "Thrs", "Threshold", true, "file+played", "Thrs{ Lvl: long }", [["Lvl ", "Level"]]);
  event("desaturate", "Dstt", "Desaturate", false, "file+played", "no descriptor");
  event("invert", "Invr", "Invert", false, "file+played", "no descriptor");
  event("gaussianBlur", "GsnB", "Gaussian Blur", true, "file+played", "GsnB{ Rds: UntF #Pxl (doub in older files) }", [["Rds ", "Radius"]]);
  event("unsharpMask", "UnsM", "Unsharp Mask", true, "file+played", "UnsM{ Amnt: UntF #Prc (long in older files), Rds: UntF #Pxl (doub), Thsh: long }",
    [["Amnt", "Amount"], ["Rds ", "Radius"], ["Thsh", "Threshold"]]);
  event("dustAndScratches", "DstS", "Dust & Scratches", true, "file+played", "DstS{ Rds: long, Thsh: long }", [["Rds ", "Radius"], ["Thsh", "Threshold"]]);
  event("median", "Mdn ", "Median", true, "file+played", "Mdn { Rds: UntF #Pxl (long in older files) }", [["Rds ", "Radius"]]);
  event("surfaceBlur", "", "Surface Blur", true, "played", "surfaceBlur{ Rds: UntF #Pxl, Thsh: long }", [["Rds ", "Radius"], ["Thsh", "Threshold"]]);
  event("motionBlur", "MtnB", "Motion Blur", true, "file", "MtnB{ Angl: long, Dstn: UntF #Pxl (long in older files) }", [["Angl", "Angle"], ["Dstn", "Distance"]]);
  event("addNoise", "AdNs", "Add Noise", true, "file", "AdNs{ Amnt: UntF #Prc (long), Dstr: enum Dstr.Unfr|Gsn , Mnch: bool }",
    [["Amnt", "Amount"], ["Dstr", "Distribution"], ["Mnch", "Monochromatic"]]);
  event("maximum", "Mxm ", "Maximum", true, "file", "Mxm { Rds: UntF #Pxl }", [["Rds ", "Radius"]]);
  event("minimum", "Mnm ", "Minimum", true, "", "", [["Rds ", "Radius"]]);
  event("highPass", "HghP", "High Pass", true, "", "", [["Rds ", "Radius"]]);
  event("offset", "Ofst", "Offset", true, "file", "Ofst{ Hrzn: long, Vrtc: long, Fl: enum FlMd.Bckg|Rpt |Wrp  }", [["Hrzn", "Horizontal"], ["Vrtc", "Vertical"], ["Fl  ", "Undefined Areas"]]);
  event("fade", "Fade", "Fade", true, "file", "Fade{ Opct: UntF #Prc, Md: enum BlnM }", [["Opct", "Opacity"], ["Md  ", "Mode"]]);
  // The image
  event("imageSize", "ImgS", "Image Size", true, "file+played",
    "ImgS{ Wdth?: UntF #Pxl|#Prc, Hght?: UntF #Pxl|#Prc, Rslt?: UntF #Rsl, scaleStyles?: bool, CnsP?: bool, Intr: enum Intp.automaticInterpolation|Bcbc|bicubicSharper|bicubicSmoother|Blnr|Nrst|preserveDetails } (Intr is the interpolation key)",
    [["Wdth", "Width"], ["Hght", "Height"], ["Rslt", "Resolution"], ["CnsP", "Constrain Proportions"], ["Intr", "Resample"]]);
  event("canvasSize", "CnvS", "Canvas Size", true, "file+played",
    "CnvS{ Rltv?: bool, Wdth?: UntF #Pxl|#Prc, Hght?: UntF #Pxl|#Prc, Hrzn: enum HrzL.Left|Cntr|Rght, Vrtc: enum VrtL.Top |Cntr|Btom, canvasExtensionColorType?: enum canvasExtensionColorType.BckC|FrgC|Wht |Blck|Gry  }",
    [["Rltv", "Relative"], ["Wdth", "Width"], ["Hght", "Height"], ["Hrzn", "Horizontal"], ["Vrtc", "Vertical"], ["canvasExtensionColorType", "Extension Color"]]);
  event("rotateEventEnum", "Rtte", "Rotate", false, "file+played",
    "Rtte{ null: ref(Enmr Dcmn Ordn.Frst) (the canvas) | ref(Enmr Lyr Ordn.Trgt) (the layer), Angl: UntF #Ang }", [["Angl", "Angle"]]);
  event("flip", "Flip", "Flip", false, "file+played", "Flip{ null: ref(Enmr Dcmn Ordn.Frst) (the canvas) | ref(Enmr Lyr Ordn.Trgt) (the layer), Axis: enum Ornt.Hrzn|Vrtc }", [["Axis", "Axis"]]);
  event("crop", "Crop", "Crop", false, "file+played",
    "no descriptor (crop to the selection) | crop{ T: Objc Rctn{ Top, Left, Btom, Rght: UntF #Pxl }, Angl: UntF #Ang, Dlt: bool }",
    [["T   ", "To"], ["Angl", "Angle"], ["Dlt ", "Delete Cropped Pixels"]]);
  event("trim", "", "Trim", true, "", "trim{ trimBasedOn: enum trimBasedOn.topLeftPixelColor|…, Top, Btom, Left, Rght: bool }");
  event("convertMode", "CnvM", "Convert Mode", false, "file+played",
    "CnvM{ T: type Grys|RGBM|CMYM|LbCM|BtmM, Fltt?: bool, Mrge?: bool } | { Dpth: long (8, 16, 32), Mrge?: bool } (bit depth)",
    [["T   ", "To"], ["Dpth", "Depth"], ["Fltt", "Flatten"], ["Mrge", "Merge"]]);
  event("flattenImage", "FltI", "Flatten Image", false, "file+played", "no descriptor");
  event("revert", "Rvrt", "Revert", false, "file", "no descriptor");
  // Layers
  event("make", "Mk  ", "Make", true, "file+played",
    "Mk { null: ref(Clss Lyr ), Usng?: Objc Lyr{ Nm: TEXT, Opct: UntF #Prc, Md: enum BlnM } } (a layer) | { null: ref(Clss layerSection), From?: ref(Enmr Lyr Ordn.Trgt) (from the selected layers), Usng: Objc layerSection{ Nm } } (a group) | { Nw: Objc Dcmn{…} } (a document) | { null: ref(Clss AdjL), Usng: Objc AdjL{ Type: … } } (an adjustment layer) | { null: ref(Clss SnpS), From: ref(prop HstS CrnH) } (a snapshot)",
    [["null", "Target"], ["Nw  ", "New"], ["From", "From"], ["Usng", "Using"]]);
  event("delete", "Dlt ", "Delete", false, "file+played", `Dlt { ${TARGET} | ref(name Lyr "…") | ref(name Chnl "…"), LyrI?: [long] }`, [["null", "Target"]]);
  event("duplicate", "Dplc", "Duplicate", true, "file+played", `Dplc{ ${TARGET}, Nm?: TEXT, Vrsn?: long 5, Idnt?: [long] } | { null: ref(Enmr Dcmn Ordn.Frst), Nm?, Mrgd?: bool } (the document)`,
    [["null", "Target"], ["Nm  ", "Name"]]);
  event("select", "slct", "Select", false, "file+played",
    'slct{ null: ref(name Lyr "…") | ref(indx Lyr n) | ref(Enmr Lyr Ordn.Frwr|Bckw|Frnt|Back), selectionModifier?: enum selectionModifierType.addToSelection|addToSelectionContinuous|removeFromSelection, MkVs: bool, LyrI?: [long] } | { null: ref(Enmr Chnl Chnl.RGB |…) } (a channel) | { null: ref(Clss <tool>) } (a tool)',
    [["null", "Target"], ["selectionModifier", "Modifier"], ["MkVs", "Make Visible"]]);
  event("selectNoLayers", "", "Deselect Layers", false, "file", `selectNoLayers{ ${TARGET} }`);
  event("show", "Shw ", "Show", false, "file+played", `Shw { null: [ref(Enmr Lyr Ordn.Trgt)], TglO?: bool }`, [["null", "Target"]]);
  event("hide", "Hd  ", "Hide", false, "file+played", `Hd  { null: [ref(Enmr Lyr Ordn.Trgt)] }`, [["null", "Target"]]);
  event("set", "setd", "Set", false, "file+played",
    "setd{ " + TARGET + ", T: Objc Lyr{ Nm?, Opct?: UntF #Prc, Md?: enum BlnM, fillOpacity?: UntF #Prc, layerLocking?: Objc layerLocking{…} } } (layer properties) | { null: ref(prop Chnl fsel), T: enum Ordn.Al  |None|Prvs, or Objc Rctn{ Top, Left, Btom, Rght } | Elps{…}, AntA?: bool } (the selection) | { null: ref(prop Prpr Lefx < Enmr Lyr Ordn.Trgt), T: Objc Lefx{ Scl: UntF #Prc, DrSh|IrSh|OrGl|IrGl|ebbl|FrFX|SoFi|GrFl|patternFill|ChFX: Objc …{ enab: bool, … } } } (layer style) | { null: ref(prop Clr  FrgC|BckC), T: Objc RGBC|HSBC|Grsc|CMYC{…} } (a color)",
    [["null", "Target"], ["T   ", "To"]]);
  event("move", "move", "Move", false, "file", `move{ ${TARGET}, T: ref(Enmr Lyr Ordn.Prvs|Nxt |Frnt|Back) | ref(indx Lyr n) }`, [["null", "Target"], ["T   ", "To"]]);
  event("mergeVisible", "MrgV", "Merge Visible", false, "file+played", "no descriptor | MrgV{ Dplc: bool } (into a new layer: Stamp Visible)", [["Dplc", "Duplicate"]]);
  event("mergeLayersNew", "Mrg2", "Merge Layers", false, "file+played", "Mrg2{} (Merge Down, Merge Layers)");
  event("mergeLayers", "MrgL", "Merge Layers", false, "file", "no descriptor | MrgL{} (older Photoshop)");
  event("rasterizeLayer", "", "Rasterize", false, "file+played", `rasterizeLayer{ ${TARGET}, What?: enum rasterizeItem.Type|placed|shape|vectorMask|layerStyle }`, [["What", "What"]]);
  event("rasterizeTypeLayer", "", "Rasterize Type Layer", false, "file", "no descriptor");
  event("disableLayerStyle", "", "Clear Layer Style", false, "played", `disableLayerStyle{ ${TARGET} }`);
  // A click in the Styles panel (Photoshop 2026 says ASty is applyStyle)
  event("applyStyle", "ASty", "Apply Style", false, "", 'ASty{ null: ref(name Styl "…"), T: ref(Enmr Lyr Ordn.Trgt) }', [["null", "Style"]]);
  event("copyToLayer", "CpTL", "Layer Via Copy", false, "file", "no descriptor");
  event("cutToLayer", "CtTL", "Layer Via Cut", false, "", "no descriptor");
  event("groupEvent", "GrpL", "Create Clipping Mask", false, "file", "no descriptor");
  event("ungroup", "Ungr", "Release Clipping Mask", false, "", "");
  event("transform", "Trnf", "Transform", true, "file+played",
    `Trnf{ ${TARGET} | ref(prop Chnl fsel), FTcs: enum QCSt.Qcsa, Ofst?: Objc Ofst{ Hrzn, Vrtc: UntF #Pxl|#Rlt }, Wdth?: UntF #Prc, Hght?: UntF #Prc, Angl?: UntF #Ang, Skew?: Objc Pnt { Hrzn, Vrtc: UntF #Ang }, Lnkd?: bool, Cpy?: bool, Intr?: enum Intp } | { null, Pstn: Objc Pnt{…}, Rltv: bool } (older)`,
    [["Ofst", "Position"], ["Wdth", "Width"], ["Hght", "Height"], ["Angl", "Angle"], ["Skew", "Skew"]]);
  // The selection
  event("inverse", "Invs", "Inverse", false, "file+played", "no descriptor");
  event("expand", "Expn", "Expand", true, "file+played", "Expn{ By: UntF #Pxl, selectionModifyEffectAtCanvasBounds?: bool }", [["By  ", "By"]]);
  event("contract", "Cntc", "Contract", true, "file+played", "Cntc{ By: UntF #Pxl, selectionModifyEffectAtCanvasBounds?: bool }", [["By  ", "By"]]);
  event("feather", "Fthr", "Feather", true, "file+played", "Fthr{ Rds: UntF #Pxl, selectionModifyEffectAtCanvasBounds?: bool }", [["Rds ", "Radius"]]);
  event("grow", "Grow", "Grow", false, "file", "Grow{ null: ref(prop Chnl fsel), Tlrn: long, AntA: bool }", [["Tlrn", "Tolerance"]]);
  event("similar", "Smlr", "Similar", false, "file", "no descriptor");
  event("autoCutout", "", "Select Subject", false, "file", "autoCutout{ sampleAllLayers: bool }", [["sampleAllLayers", "Sample All Layers"]]);
  // Painting
  event("fill", "Fl  ", "Fill", true, "file+played",
    "Fl  { Usng: enum FlCn.FrgC|BckC|Blck|Gry |Wht |Clr |Ptrn|contentAware, Clr?: Objc RGBC|HSBC{…} (with FlCn.Clr ), contentAwareColorAdaptationFill?: bool, Opct: UntF #Prc, Md: enum BlnM, PrsT?: bool }",
    [["Usng", "Using"], ["Clr ", "Color"], ["Opct", "Opacity"], ["Md  ", "Mode"], ["PrsT", "Preserve Transparency"]]);
  event("stroke", "Strk", "Stroke", true, "file+played", "Strk{ Wdth: long (px), Lctn: enum StrL.Insd|Cntr|Otsd, Opct: UntF #Prc, Md: enum BlnM, Clr?: Objc RGBC|HSBC{…}, PrsT?: bool }",
    [["Wdth", "Width"], ["Lctn", "Location"], ["Opct", "Opacity"], ["Md  ", "Mode"], ["Clr ", "Color"]]);
  event("clearEvent", "Cler", "Clear", false, "file", "no descriptor (delete the selected pixels)");
  event("reset", "Rset", "Reset", false, "file", "Rset{ null: ref(prop Clr  Clrs) } (default colors)");
  event("exchange", "Exch", "Exchange", false, "file", "Exch{ null: ref(prop Clr  Clrs) } (swap colors)");
  // Edit
  event("copyEvent", "copy", "Copy", false, "file+played", "no descriptor");
  event("copyMerged", "CpyM", "Copy Merged", false, "file", "no descriptor");
  event("cut", "cut ", "Cut", false, "file", "no descriptor");
  event("paste", "past", "Paste", false, "file+played", "no descriptor | past{ AntA?: enum Annt.antiAliasNone, As?: type Pxel }");
  event("purge", "Prge", "Purge", false, "file", "Prge{ null: enum PrgI.Al   }");
  // Files and playback
  event("save", "save", "Save", true, "file+played",
    "save{ As: Objc Pht3{ maximizeCompatibility?: bool } | PNGF{…} | JPEG{ EQlt: long, MttC: enum } | TIFF{…}, In: alis (Photoshop's) | 'Pth ' (read back), DocI?: long, Cpy?: bool, LwCs?: bool }",
    [["As  ", "As"], ["In  ", "In"], ["Cpy ", "As a Copy"]]);
  event("close", "Cls ", "Close", false, "file+played", "Cls { Svng: enum YsN .N   |Ys  , DocI?: long, forceNotify?: bool }", [["Svng", "Saving"]]);
  event("export", "Expr", "Export", true, "", "");
  event("open", "Opn ", "Open", true, "", "");
  event("placeEvent", "Plc ", "Place", true, "", "");
  event("stop", "Stop", "Stop", true, "file", 'Stop{ Msge: TEXT, Cntn?: bool } (class "null" in recent files; always played with its dialog)', [["Msge", "Message"], ["Cntn", "Allow Continue"]]);
  event("play", "Ply ", "Play", false, "file+played", 'Ply { null: ref(name Actn "…" < name ASet "…") }', [["null", "Action"]]);

  // The entry of an event, from an item, a stored event, a char id or a string id
  const eventInfo = (what) => {
    const id = what && typeof what === "object" ? what.event : what;
    if (typeof id !== "string") return null;
    if (EVENTS[id]) return EVENTS[id];
    const s = stringId(id);
    if (EVENTS[s]) return EVENTS[s];
    for (const key of Object.keys(EVENTS)) if (EVENTS[key].id && EVENTS[key].id === id) return EVENTS[key];
    return null;
  };

  /* ------------------------------ what a step says ------------------------------ */

  // Ids Photoshop names after another meaning of the same code (see TERMS), and acronyms
  const KEY_WORDS = { null: "target", Cntr: "contrast", Intr: "interpolation", "Grn ": "green", Dstr: "distribution", StrL: "strokeLocation", "Gd  ": "guide", "Pnt ": "point", "Lyr ": "layer", Chnl: "channel", fsel: "selection" };
  const ACRONYMS = /^(rgb|cmyk|hsb|lab|png|jpeg|tiff|gif|pdf|psd|id|icc)$/i;
  // An id or a string id as words: "canvasExtensionColorType" → "Canvas extension color type"
  const words = (id, asKey) => {
    let s = asKey && KEY_WORDS[id] ? KEY_WORDS[id] : stringId(id);
    if (!s) return "";
    s = s.replace(/(ClassEvent|Event|Enum)$/, "") || s;
    const parts = s
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((w, i) => (ACRONYMS.test(w) ? w.toUpperCase() : i ? w.toLowerCase() : w));
    const out = parts.join(" ");
    return out.charAt(0).toUpperCase() + out.slice(1);
  };
  // A name Photoshop stores as "$$$/Presets/…/Commands=Commands" shows as "Commands"
  const displayName = (name) => {
    const s = String(name == null ? "" : name);
    const at = s.indexOf("=");
    return s.startsWith("$$$/") && at > 0 ? s.slice(at + 1) : s;
  };

  // The step's name, in English for the events above, else as the file names it
  const label = (item) => {
    const info = eventInfo(item);
    if (info) return info.label;
    const d = item && item.descriptor;
    const unicode = d && displayName(d.name).trim();
    if (unicode) return unicode;
    const dictionary = item && item.dictionaryName;
    if (dictionary && ASCII.test(dictionary) && dictionary.trim()) return displayName(dictionary);
    return words(item && item.event) || "?";
  };

  const UNIT_TEXT = { "#Pxl": " px", "#Prc": "%", "#Ang": "°", "#Rsl": " ppi", "#Rlt": " pt", "#Pnt": " pt", "#Mlm": " mm", "#Nne": "" };
  const round = (n) => (Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(n));
  const ORDINALS = { Trgt: "current", Frwr: "forward", Bckw: "backward", Frnt: "front", Back: "back", Prvs: "previous", "Nxt ": "next", Frst: "first", "Lst ": "last", "Al  ": "all", None: "none" };
  // An enum's value without the words its type repeats: presetKindType.presetKindCustom → "Custom"
  const enumWords = (type, v) => {
    const prefix = stringId(type).replace(/Type$/, "");
    const s = stringId(v);
    return prefix && s.length > prefix.length && s.startsWith(prefix) && /[A-Z]/.test(s.charAt(prefix.length)) ? words(s.slice(prefix.length)) : words(v);
  };
  // A reference as words, from the outside in: "Layer “Bg”", "current layer", "Selection"
  const describeRef = (refs) =>
    refs
      .map((r) => {
        const what = words(r.classId, true).toLowerCase();
        switch (r.form) {
          case "Enmr":
            if (same(r.enumType, "Ordn")) return `${ORDINALS[r.value] || words(r.value).toLowerCase()} ${what}`;
            return `${enumWords(r.enumType, r.value)} ${what}`;
          case "name":
            return `${what} “${r.value}”`;
          case "indx":
            return `${what} ${r.index}`;
          case "Idnt":
            return `${what} #${r.id}`;
          case "rele":
            return `${what} ${r.offset > 0 ? "+" : ""}${r.offset}`;
          case "prop":
            return words(r.key, true).toLowerCase();
          default:
            return what;
        }
      })
      .join(" of ");
  // A value as short text
  const show = (v, depth = 0) => {
    if (!v || typeof v !== "object") return String(v);
    switch (v.type) {
      case "UntF":
        return round(v.value) + (v.unit in UNIT_TEXT ? UNIT_TEXT[v.unit] : ` ${v.unit}`);
      case "doub":
      case "long":
      case "comp":
        return round(Number(v.value));
      case "bool":
        return v.value ? "on" : "off";
      case "TEXT": {
        const s = displayName(v.value);
        return `“${s.length > 60 ? s.slice(0, 59) + "…" : s}”`;
      }
      case "enum":
        return enumWords(v.enumType, v.value);
      case "type":
      case "GlbC":
        return words(v.classId);
      case "obj ":
        return describeRef(v.refs);
      case "VlLs":
        return v.values.length > 6 ? `${v.values.length} items` : v.values.map((x) => show(x, depth + 1)).join(", ");
      case "UnFl":
        return `${v.values.length} values`;
      case "Objc":
      case "GlbO": {
        const inside = depth < 2 ? itemsOf(v).map(([k, x]) => `${words(k, true)}: ${show(x, depth + 1)}`).join(", ") : "…";
        return inside ? `${words(v.classId, true)} (${inside})` : words(v.classId, true);
      }
      case "alis":
      case "Pth ":
        return pathOf(v) || "a file";
      default:
        return v.type;
    }
  };

  // What the panel shows under a step: [{ key, label, text }], the known keys first, in the
  // catalogue's words; an unknown key in words of its string id
  const params = (item) => {
    const d = item && item.descriptor;
    if (!d) return [];
    const info = eventInfo(item);
    const known = info ? info.params : [];
    return itemsOf(d)
      .map(([key, v]) => {
        const p = known.find((k) => same(k.key, key));
        return { key, label: p ? p.label : words(key, true), text: show(v), order: p ? known.indexOf(p) : known.length };
      })
      .sort((a, b) => a.order - b.order)
      .map(({ key, label: name, text: t }) => ({ key, label: name, text: t }));
  };
  // "Gaussian Blur — Radius: 4.2 px"
  const summary = (item) => {
    const list = params(item);
    return list.length ? `${label(item)} — ${list.map((p) => `${p.label}: ${p.text}`).join(", ")}` : label(item);
  };
  // The title Photoshop's panel gives a step: the event and what it acts on ("Set Selection",
  // "Select layer “Bg”", "Make layer", "Delete current layer")
  const title = (item) => {
    const d = item && item.descriptor;
    const base = label(item);
    if (!d) return base;
    const target = get(d, "null");
    const made = get(d, "Nw  ");
    let what = "";
    if (target && target.type === "obj ") what = describeRef(target.refs);
    else if (target && target.type === "VlLs" && target.values[0] && target.values[0].type === "obj ") what = describeRef(target.values[0].refs);
    else if (made && (made.type === "Objc" || made.type === "type")) what = words(made.classId, true).toLowerCase();
    if (what === "selection") what = "Selection";
    return what ? `${base} ${what}` : base;
  };

  /* ------------------------------- ready-made steps ------------------------------- */

  // Steps in the shapes the catalogue confirms, from plain options: make.gaussianBlur({ radius:
  // 4.2 }) is the Gaussian Blur step Photoshop records. Each returns an item; a second argument
  // overrides its flags ({ withDialog: true, enabled: false }). Ids in options can be char ids or
  // string ids ("multiply" or "Mltp", "foregroundColor" or "FrgC"). Colors are { red, green,
  // blue } from 0 to 255.
  const rgb = (c) => obj("RGBC", { "Rd  ": num(c.red), "Grn ": num(c.green), "Bl  ": num(c.blue) });
  const channelRef = (channel = "Cmps") => ref(refEnum("Chnl", "Chnl", channel));
  const pair = (values) => (values ? list(values.map(int)) : undefined);
  const layerRef = (o = {}) => {
    if (o.name !== undefined) return refName("Lyr ", o.name);
    if (o.index !== undefined) return refIndex("Lyr ", o.index);
    if (o.id !== undefined) return refId("Lyr ", o.id);
    return target();
  };
  const ANCHORS = { left: "Left", center: "Cntr", right: "Rght", top: "Top ", middle: "Cntr", bottom: "Btom" };
  const ORDINAL_OF = { forward: "Frwr", backward: "Bckw", front: "Frnt", back: "Back" };
  const MODES = { grayscale: "Grys", rgb: "RGBM", cmyk: "CMYM", lab: "LbCM", bitmap: "BtmM" };
  const FORMATS = {
    psd: () => obj("Pht3", { maximizeCompatibility: true }),
    png: () => obj("PNGF", { PNGInterlaceType: enumv("PGIT", "PGIN"), PNGFilter: enumv("PNGf", "PGAd"), Cmpr: int(6) }),
    jpeg: (o) => obj("JPEG", { EQlt: int(o.quality === undefined ? 10 : o.quality), MttC: enumv("MttC", "None") }),
  };
  const make = {
    gaussianBlur: (o) => step("gaussianBlur", { "Rds ": px(o.radius) }),
    // { input: [black, white], gamma, output: [black, white], channel: "Cmps" | "red" | … }
    levels: (o) =>
      step("levels", {
        presetKind: enumv("presetKindType", "presetKindCustom"),
        Adjs: list([obj("LvlA", { Chnl: channelRef(o.channel), Inpt: pair(o.input), "Gmm ": o.gamma === undefined ? undefined : num(o.gamma), Otpt: pair(o.output) })]),
      }),
    autoLevels: () => step("levels", { Auto: true }),
    autoContrast: () => step("levels", { AuCo: true }),
    // { points: [[input, output], …] } from 0 to 255, both ends included
    curves: (o) =>
      step("curves", {
        presetKind: enumv("presetKindType", "presetKindCustom"),
        Adjs: list([obj("CrvA", { Chnl: channelRef(o.channel), "Crv ": list(o.points.map(([x, y]) => obj("Pnt ", { Hrzn: num(x), Vrtc: num(y) }))) })]),
      }),
    brightnessContrast: (o) => step("brightnessEvent", { Brgh: int(o.brightness || 0), Cntr: int(o.contrast || 0), useLegacy: Boolean(o.legacy) }),
    hueSaturation: (o) =>
      step("hueSaturation", {
        presetKind: enumv("presetKindType", "presetKindCustom"),
        Clrz: Boolean(o.colorize),
        Adjs: list([obj("Hst2", { "H   ": int(o.hue || 0), Strt: int(o.saturation || 0), Lght: int(o.lightness || 0) })]),
      }),
    threshold: (o) => step("thresholdClassEvent", { "Lvl ": int(o.level) }),
    desaturate: () => step("desaturate", null),
    invert: () => step("invert", null),
    unsharpMask: (o) => step("unsharpMask", { Amnt: pct(o.amount), "Rds ": px(o.radius), Thsh: int(o.threshold || 0) }),
    dustAndScratches: (o) => step("dustAndScratches", { "Rds ": int(o.radius), Thsh: int(o.threshold || 0) }),
    median: (o) => step("median", { "Rds ": px(o.radius) }),
    surfaceBlur: (o) => step("surfaceBlur", { "Rds ": px(o.radius), Thsh: int(o.threshold) }),
    // { width, height } in px (or { unit: "%" }), { resolution } in ppi
    imageSize: (o) =>
      step("imageSize", {
        Wdth: o.width === undefined ? undefined : unit(o.unit || "px", o.width),
        Hght: o.height === undefined ? undefined : unit(o.unit || "px", o.height),
        Rslt: o.resolution === undefined ? undefined : unit("#Rsl", o.resolution),
        scaleStyles: true,
        CnsP: o.constrain !== false,
        Intr: enumv("Intp", o.interpolation || "automaticInterpolation"),
      }),
    // { width, height, unit, relative, anchor: ["center", "middle"], color: "backgroundColor" }
    canvasSize: (o) => {
      const [h, v] = o.anchor || ["center", "middle"];
      return step("canvasSize", {
        Rltv: o.relative ? true : undefined,
        Wdth: o.width === undefined ? undefined : unit(o.unit || "px", o.width),
        Hght: o.height === undefined ? undefined : unit(o.unit || "px", o.height),
        Hrzn: enumv("HrzL", ANCHORS[h] || h),
        Vrtc: enumv("VrtL", ANCHORS[v] || v),
        canvasExtensionColorType: enumv("canvasExtensionColorType", o.color || "BckC"),
      });
    },
    rotateCanvas: (o) => step("rotateEventEnum", { null: ref(refEnum("Dcmn", "Ordn", "Frst")), Angl: angle(o.angle) }),
    flipCanvas: (o) => step("flip", { null: ref(refEnum("Dcmn", "Ordn", "Frst")), Axis: enumv("Ornt", o.axis === "vertical" ? "Vrtc" : "Hrzn") }),
    flipLayer: (o) => step("flip", { null: ref(target()), Axis: enumv("Ornt", o.axis === "vertical" ? "Vrtc" : "Hrzn") }),
    // No options: crop to the selection; else { top, left, bottom, right } in px
    crop: (o) =>
      o && o.right !== undefined
        ? step("crop", {
            "T   ": obj("Rctn", { "Top ": px(o.top), Left: px(o.left), Btom: px(o.bottom), Rght: px(o.right) }),
            Angl: angle(o.angle || 0),
            "Dlt ": o.deletePixels !== false,
          })
        : step("crop", null),
    // { mode: "grayscale" | "rgb" | "cmyk" | "lab", flatten, merge }
    convertMode: (o) => step("convertMode", { "T   ": cls(MODES[o.mode] || o.mode), Fltt: o.flatten, Mrge: o.merge }),
    flattenImage: () => step("flattenImage", null),
    mergeVisible: () => step("mergeVisible", null),
    stampVisible: () => step("mergeVisible", { Dplc: true }),
    mergeLayers: () => step("mergeLayersNew", {}),
    // { name, opacity, mode }
    makeLayer: (o = {}) =>
      step("make", {
        null: ref(refClass("Lyr ")),
        Usng:
          o.name !== undefined || o.opacity !== undefined || o.mode !== undefined
            ? obj("Lyr ", { "Nm  ": o.name, Opct: o.opacity === undefined ? undefined : pct(o.opacity), "Md  ": o.mode && enumv("BlnM", o.mode) })
            : undefined,
      }),
    // { name, fromLayers: true to put the selected layers in it }
    makeGroup: (o = {}) =>
      step("make", { null: ref(refClass("layerSection")), From: o.fromLayers ? ref(target()) : undefined, Usng: obj("layerSection", { "Nm  ": o.name }) }),
    // { name } or { index } or nothing (the current layer)
    deleteLayer: (o) => step("delete", { null: ref(layerRef(o)) }),
    duplicateLayer: (o = {}) => step("duplicate", { null: ref(target()), "Nm  ": o.name, Vrsn: int(5) }),
    // { name } | { index } | { direction: "forward" | "backward" | "front" | "back" }; { add: true }.
    // An index counts from the bottom: 1 is the lowest layer above the Background (Photoshop
    // 2026 played index 2 of Background, A, B as B)
    selectLayer: (o) =>
      step("select", {
        null: ref(o.direction ? refEnum("Lyr ", "Ordn", ORDINAL_OF[o.direction] || o.direction) : layerRef(o)),
        selectionModifier: o.add ? enumv("selectionModifierType", "addToSelection") : undefined,
        MkVs: Boolean(o.makeVisible),
      }),
    showLayer: (o) => step("show", { null: list([ref(layerRef(o))]) }),
    hideLayer: (o) => step("hide", { null: list([ref(layerRef(o))]) }),
    // { opacity, fillOpacity, mode }. Photoshop 2026 applies a name given with other
    // properties and drops the rest (it records a rename as a step of its own): renameLayer
    setLayer: (o) => {
      if (o.name !== undefined) fail("make.setLayer: rename in a step of its own (make.renameLayer)");
      return step(
        "set",
        {
          null: ref(target()),
          "T   ": obj("Lyr ", {
            Opct: o.opacity === undefined ? undefined : pct(o.opacity),
            fillOpacity: o.fillOpacity === undefined ? undefined : pct(o.fillOpacity),
            "Md  ": o.mode && enumv("BlnM", o.mode),
          }),
        },
        { dialogOptions: 2 }
      );
    },
    renameLayer: (o) => step("set", { null: ref(target()), "T   ": obj("Lyr ", { "Nm  ": String(o.name) }) }, { dialogOptions: 2 }),
    selectAll: () => step("set", { null: ref(refProp("Chnl", "fsel")), "T   ": enumv("Ordn", "Al  ") }, { dialogOptions: 2 }),
    deselect: () => step("set", { null: ref(refProp("Chnl", "fsel")), "T   ": enumv("Ordn", "None") }, { dialogOptions: 2 }),
    // { top, left, bottom, right } in px
    selectRect: (o) =>
      step("set", { null: ref(refProp("Chnl", "fsel")), "T   ": obj("Rctn", { "Top ": px(o.top), Left: px(o.left), Btom: px(o.bottom), Rght: px(o.right) }) }, { dialogOptions: 2 }),
    inverse: () => step("inverse", null),
    expand: (o) => step("expand", { "By  ": px(o.by) }),
    contract: (o) => step("contract", { "By  ": px(o.by) }),
    feather: (o) => step("feather", { "Rds ": px(o.radius) }),
    // { using: "foregroundColor" | "backgroundColor" | "black" | "white" | "gray" | "color" |
    //   "contentAware", color, opacity, mode, preserveTransparency }
    fill: (o) =>
      step("fill", {
        Usng: enumv("FlCn", o.color && !o.using ? "Clr " : o.using || "FrgC"),
        "Clr ": o.color && rgb(o.color),
        contentAwareColorAdaptationFill: same(o.using || "", "contentAware") ? true : undefined,
        Opct: pct(o.opacity === undefined ? 100 : o.opacity),
        "Md  ": enumv("BlnM", o.mode || "Nrml"),
        PrsT: o.preserveTransparency ? true : undefined,
      }),
    // { width (px), location: "inside" | "center" | "outside", color, opacity, mode }
    stroke: (o) =>
      step("stroke", {
        Wdth: int(o.width),
        Lctn: enumv("StrL", { inside: "Insd", center: "Cntr", outside: "Otsd" }[o.location] || o.location || "Cntr"),
        Opct: pct(o.opacity === undefined ? 100 : o.opacity),
        "Md  ": enumv("BlnM", o.mode || "Nrml"),
        "Clr ": rgb(o.color || { red: 0, green: 0, blue: 0 }),
      }),
    // Free Transform of the current layer ({ selection: true }: of the selection):
    // { x, y } offset in px, { width, height } in %, { angle } and { skewX, skewY } in degrees
    transform: (o) =>
      step("transform", {
        null: ref(o.selection ? refProp("Chnl", "fsel") : target()),
        FTcs: enumv("QCSt", "Qcsa"),
        Ofst: o.x || o.y ? obj("Ofst", { Hrzn: px(o.x || 0), Vrtc: px(o.y || 0) }) : undefined,
        Wdth: o.width === undefined ? undefined : pct(o.width),
        Hght: o.height === undefined ? undefined : pct(o.height),
        Angl: o.angle === undefined ? undefined : angle(o.angle),
        Skew: o.skewX || o.skewY ? obj("Pnt ", { Hrzn: angle(o.skewX || 0), Vrtc: angle(o.skewY || 0) }) : undefined,
        Intr: enumv("Intp", "Bcbc"),
      }),
    rasterizeLayer: (o = {}) => step("rasterizeLayer", { null: ref(target()), What: o.what && enumv("rasterizeItem", o.what) }),
    // effects: [[key, Objc], …] or { dropShadow: obj("DrSh", {…}), … } (see the "set" shape)
    setLayerStyle: (effects, scale = 100) =>
      step("set", { null: ref(refProp("Prpr", "Lefx"), target()), "T   ": obj("Lefx", [["Scl ", pct(scale)]].concat(toItems(effects))) }),
    clearLayerStyle: () => step("disableLayerStyle", { null: ref(target()) }),
    // A style of the Styles panel, by its name ({ name })
    applyStyle: (o) => step("applyStyle", { null: ref(refName("Styl", o.name)), "T   ": ref(target()) }),
    // { as: "psd" | "png" | "jpeg", path (POSIX, Mac), copy, quality (jpeg, 0–12) }; without a
    // path Photoshop asks where
    save: (o) =>
      step("save", { "As  ": (FORMATS[o.as] || FORMATS.psd)(o), "In  ": o.path === undefined ? undefined : fileAlias(o.path), "Cpy ": o.copy ? true : undefined, LwCs: true }),
    close: (o = {}) => step("close", { Svng: enumv("YsN ", o.save ? "Ys  " : "N   ") }),
    stop: (o) => step("stop", { Msge: String(o.message || ""), Cntn: o.allowContinue !== false }, { withDialog: true }),
    play: (o) => step("play", { null: ref(refName("Actn", o.action), refName("ASet", o.set)) }),
    copy: () => step("copyEvent", null),
    cut: () => step("cut", null),
    paste: () => step("paste", null),
  };
  for (const name of Object.keys(make)) {
    const build = make[name];
    make[name] = (options = {}, flags) => Object.assign(build(options), flags);
  }

  const api = {
    VERSION,
    AtnError,
    // the file
    parse,
    write,
    parseDescriptor,
    parseDescriptorAt,
    writeDescriptor,
    parsePalette,
    writePalette,
    // building
    file,
    action,
    step,
    desc,
    obj,
    list,
    unit,
    px,
    pct,
    angle,
    num,
    int,
    bool,
    text,
    enumv,
    cls,
    ref,
    refClass,
    refProp,
    refEnum,
    refName,
    refIndex,
    refId,
    refOffset,
    target,
    fileAlias,
    filePath,
    make,
    // reading
    get,
    getAll,
    keyOf,
    value,
    pathOf,
    same,
    charId,
    stringId,
    toId,
    TERMS,
    EVENTS,
    eventInfo,
    label,
    title,
    params,
    summary,
    words,
    displayName,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TypeRATN = api;
})(typeof window !== "undefined" ? window : globalThis);
