import React, { useRef, useState, useEffect } from "react";

export default function SelectionCanvas({ imageSrc, onCropAll }) {

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);

  const [rect, setRect] = useState(null);
  const [rects, setRects] = useState([]);

  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {

    if (!imageSrc) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {

      const maxWidth = 900;

      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {

        const scale = maxWidth / width;
        width = maxWidth;
        height = height * scale;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      imgRef.current = img;
      setImageLoaded(true);
    };

  }, [imageSrc]);

  const redraw = () => {

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;

    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    rects.forEach(r => {

      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;

      ctx.strokeRect(r.x, r.y, r.w, r.h);
    });

    if (rect) {

      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;

      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  };

  const getMouse = (clientX, clientY) => {

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrag = (x,y)=>{
    setStart({x,y});
    setDragging(true);
  }

  const moveDrag = (x,y)=>{
    if (!dragging || !start) return;

    const newRect = {
      x: Math.min(start.x,x),
      y: Math.min(start.y,y),
      w: Math.abs(x-start.x),
      h: Math.abs(y-start.y)
    };

    setRect(newRect);
  }

  const endDrag = ()=>{
    if(rect){
      setRects(prev=>[...prev,rect]);
      setRect(null);
    }
    setDragging(false);
  }

  const handleMouseDown = (e)=>{
    if (!imageLoaded) return;
    const p=getMouse(e.clientX,e.clientY);
    startDrag(p.x,p.y);
  }

  const handleMouseMove = (e)=>{
    const p=getMouse(e.clientX,e.clientY);
    moveDrag(p.x,p.y);
  }

  const handleMouseUp = ()=>{
    endDrag();
  }

  const handleTouchStart=(e)=>{
    if(!imageLoaded) return;
    const t=e.touches[0];
    const p=getMouse(t.clientX,t.clientY);
    startDrag(p.x,p.y);
  }

  const handleTouchMove=(e)=>{
    const t=e.touches[0];
    const p=getMouse(t.clientX,t.clientY);
    moveDrag(p.x,p.y);
  }

  const handleTouchEnd=()=>{
    endDrag();
  }

  useEffect(()=>{
    if(!imageLoaded) return;
    redraw();
  },[rect,rects,imageLoaded]);

  const translateAll = async () => {

    if (rects.length === 0) return;

    const canvas = canvasRef.current;
    const crops = [];

    for (const r of rects) {

      const cropCanvas = document.createElement("canvas");

      cropCanvas.width = r.w;
      cropCanvas.height = r.h;

      const cropCtx = cropCanvas.getContext("2d");

      cropCtx.drawImage(
        canvas,
        r.x,
        r.y,
        r.w,
        r.h,
        0,
        0,
        r.w,
        r.h
      );

      const base64 = cropCanvas
        .toDataURL("image/png")
        .split(",")[1];

      crops.push(base64);
    }

    await onCropAll(crops);
  };

  const clearSelections = () => {

    setRects([]);
    setRect(null);
  };

  return (

    <div>

      {!imageLoaded && (
        <div style={{ marginBottom: 8 }}>
          Loading image...
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>

        <button
          onClick={translateAll}
          style={{
            padding: "8px 14px",
            border: "1px solid #555",
            borderRadius: 6,
            background: "#2d2d2d",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Translate All ({rects.length})
        </button>

        <button
          onClick={clearSelections}
          style={{
            padding: "8px 14px",
            border: "1px solid #555",
            borderRadius: 6,
            background: "#2d2d2d",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Clear
        </button>

      </div>

      <canvas
        ref={canvasRef}
        style={{
          border: "1px solid #555",
          cursor: "crosshair",
          touchAction:"none"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

    </div>
  );
}