export function createDemoStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") {
    throw new Error("This browser can't run the demo camera.");
  }

  let frame = 0;
  const draw = () => {
    frame += 1;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#2a1812");
    gradient.addColorStop(0.55, "#8a3b24");
    gradient.addColorStop(1, "#e4572e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(80, 60, canvas.width - 160, canvas.height - 120);
    ctx.fillStyle = "#f6efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 140px system-ui, sans-serif";
    const wobble = Math.sin(frame / 18) * 48;
    ctx.fillText("GUEST", canvas.width / 2 + wobble, canvas.height / 2 - 10);
    ctx.font = "600 36px system-ui, sans-serif";
    ctx.fillText("Demo camera", canvas.width / 2, canvas.height / 2 + 110);
  };
  draw();
  const timer = window.setInterval(draw, 1000 / 30);
  const stream = canvas.captureStream(30);
  stream.getVideoTracks()[0]?.addEventListener("ended", () => window.clearInterval(timer));
  return stream;
}
