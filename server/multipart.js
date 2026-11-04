export function parseMultipart(body, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let idx = body.indexOf(marker);
  if (idx < 0) {
    const err = new Error("Upload was not a valid form.");
    err.status = 400;
    throw err;
  }
  let pos = idx + marker.length;
  while (pos < body.length) {
    if (body[pos] === 45 && body[pos + 1] === 45) break;
    if (body[pos] === 13 && body[pos + 1] === 10) pos += 2;
    const headerEnd = indexOfBuffer(body, Buffer.from("\r\n\r\n"), pos);
    if (headerEnd < 0) break;
    const headerText = body.toString("utf8", pos, headerEnd);
    const dataStart = headerEnd + 4;
    const next = indexOfBuffer(body, marker, dataStart);
    if (next < 0) break;
    let dataEnd = next;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;
    const name = /name="([^"]*)"/.exec(headerText)?.[1] || "";
    const filename = /filename="([^"]*)"/.exec(headerText)?.[1] || "";
    const mime = /content-type:\s*([^\r\n;]+)/i.exec(headerText)?.[1]?.trim() || "application/octet-stream";
    parts.push({ name, filename, mime, data: body.subarray(dataStart, dataEnd) });
    pos = next + marker.length;
  }
  return parts;
}

function indexOfBuffer(buf, needle, from) {
  return buf.indexOf(needle, from);
}

export function boundaryFrom(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return (match?.[1] || match?.[2] || "").trim();
}
