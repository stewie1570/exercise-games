import { Landmark, getLandmark, isVisible, midpoint } from "./landmarks";

const toPoint = (landmark, width, height, mirror) => {
  if (!landmark) {
    return null;
  }

  return {
    x: (mirror ? 1 - landmark.x : landmark.x) * width,
    y: landmark.y * height,
  };
};

const drawLine = (ctx, from, to, color, width) => {
  if (!from || !to) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
};

const drawCircle = (ctx, center, radius, fill, stroke, lineWidth) => {
  if (!center) {
    return;
  }

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
};

const drawLabel = (ctx, point, text, color) => {
  if (!point || text == null) {
    return;
  }

  ctx.font = "600 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
  ctx.strokeText(text, point.x, point.y);
  ctx.fillStyle = color;
  ctx.fillText(text, point.x, point.y);
};

const formatDeg = (value) => (value == null ? null : `${Math.round(value)}°`);

export const drawStickFigure = (
  ctx,
  landmarks,
  { width, height, mirror = true, angles } = {}
) => {
  if (!ctx || !Array.isArray(landmarks) || !width || !height) {
    return;
  }

  const point = (index) => {
    const landmark = getLandmark(landmarks, index);
    return isVisible(landmark) ? toPoint(landmark, width, height, mirror) : null;
  };

  const nose = point(Landmark.nose);
  const leftEar = point(Landmark.leftEar);
  const rightEar = point(Landmark.rightEar);
  const leftShoulder = point(Landmark.leftShoulder);
  const rightShoulder = point(Landmark.rightShoulder);
  const leftElbow = point(Landmark.leftElbow);
  const rightElbow = point(Landmark.rightElbow);
  const leftWrist = point(Landmark.leftWrist);
  const rightWrist = point(Landmark.rightWrist);
  const leftHip = point(Landmark.leftHip);
  const rightHip = point(Landmark.rightHip);

  const earMid = leftEar && rightEar ? midpoint(leftEar, rightEar) : null;
  const head = earMid || nose;
  const shoulderMid =
    leftShoulder && rightShoulder ? midpoint(leftShoulder, rightShoulder) : null;
  const hipMid = leftHip && rightHip ? midpoint(leftHip, rightHip) : null;

  const headRadius = (() => {
    if (leftEar && rightEar) {
      return Math.max(16, Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y) / 1.6);
    }
    return Math.max(18, height * 0.05);
  })();

  ctx.save();
  ctx.lineJoin = "round";

  drawLine(ctx, leftHip, rightHip, "#94a3b8", 6);
  drawLine(ctx, shoulderMid, hipMid, "#e2e8f0", 10);
  drawLine(ctx, leftShoulder, rightShoulder, "#f8fafc", 10);

  drawLine(ctx, leftShoulder, leftElbow, "#38bdf8", 9);
  drawLine(ctx, leftElbow, leftWrist, "#7dd3fc", 8);
  drawLine(ctx, rightShoulder, rightElbow, "#fb7185", 9);
  drawLine(ctx, rightElbow, rightWrist, "#fda4af", 8);

  if (head && shoulderMid) {
    const neckStart = {
      x: head.x,
      y: head.y + headRadius * 0.85,
    };
    drawLine(ctx, neckStart, shoulderMid, "#f8fafc", 8);
  }

  drawCircle(ctx, head, headRadius, "rgba(250, 250, 250, 0.12)", "#f8fafc", 5);
  drawCircle(ctx, leftShoulder, 7, "#38bdf8");
  drawCircle(ctx, rightShoulder, 7, "#fb7185");
  drawCircle(ctx, leftElbow, 7, "#38bdf8");
  drawCircle(ctx, rightElbow, 7, "#fb7185");
  drawCircle(ctx, leftWrist, 6, "#7dd3fc");
  drawCircle(ctx, rightWrist, 6, "#fda4af");

  if (angles) {
    if (head) {
      const tilt = formatDeg(angles.head?.tiltDeg);
      const turn = formatDeg(angles.head?.turnDeg);
      drawLabel(
        ctx,
        { x: head.x, y: head.y - headRadius - 16 },
        [tilt && `tilt ${tilt}`, turn && `turn ${turn}`].filter(Boolean).join("  "),
        "#f8fafc"
      );
    }

    drawLabel(ctx, leftElbow && { x: leftElbow.x, y: leftElbow.y - 18 }, formatDeg(angles.leftArm?.elbowDeg), "#7dd3fc");
    drawLabel(ctx, rightElbow && { x: rightElbow.x, y: rightElbow.y - 18 }, formatDeg(angles.rightArm?.elbowDeg), "#fda4af");
    drawLabel(
      ctx,
      leftShoulder && { x: leftShoulder.x - 28, y: leftShoulder.y - 16 },
      formatDeg(angles.leftArm?.upperArmDeg),
      "#38bdf8"
    );
    drawLabel(
      ctx,
      rightShoulder && { x: rightShoulder.x + 28, y: rightShoulder.y - 16 },
      formatDeg(angles.rightArm?.upperArmDeg),
      "#fb7185"
    );
  }

  ctx.restore();
};

export const drawMirroredVideo = (ctx, video, width, height) => {
  if (!ctx || !video || !width || !height) {
    return;
  }

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
};
