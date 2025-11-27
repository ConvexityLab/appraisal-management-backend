/**
 * OCR Visualization Component
 * 
 * Displays an image with bounding boxes overlay based on OCR results
 * Shows detected text blocks with confidence scores and allows interaction
 */

import React, { useRef, useEffect, useState } from 'react';
import ocrResults from '../../OCRResults.json';
import './OCRVisualization.css';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextBlock {
  block_id: number;
  text: string;
  confidence: number;
  bounding_box: number[][];
}

interface OCRVisualizationProps {
  imageSrc?: string;
  showConfidence?: boolean;
  minConfidence?: number;
  highlightLowConfidence?: boolean;
}

const OCRVisualization: React.FC<OCRVisualizationProps> = ({
  imageSrc = '/mortgage-statement.jpg', // Update this path to match your image
  showConfidence = true,
  minConfidence = 0.0,
  highlightLowConfidence = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<TextBlock | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Convert OCR bounding box format to canvas coordinates
  const convertBoundingBox = (ocrBox: number[][], imageWidth: number, imageHeight: number): BoundingBox => {
    // OCR bounding box format: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
    const x1 = Math.min(...ocrBox.map(point => point[0]));
    const y1 = Math.min(...ocrBox.map(point => point[1]));
    const x2 = Math.max(...ocrBox.map(point => point[0]));
    const y2 = Math.max(...ocrBox.map(point => point[1]));

    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    };
  };

  // Get color based on confidence level
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.95) return '#00ff00'; // Green - high confidence
    if (confidence >= 0.85) return '#ffff00'; // Yellow - medium confidence
    if (confidence >= 0.70) return '#ff8800'; // Orange - low-medium confidence
    return '#ff0000'; // Red - low confidence
  };

  // Draw bounding boxes on canvas
  const drawBoundingBoxes = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !image || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image first
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Filter text blocks by confidence
    const filteredBlocks = ocrResults.detected_text.text_blocks.filter(
      block => block.confidence >= minConfidence
    );

    // Draw bounding boxes
    filteredBlocks.forEach((block: TextBlock) => {
      const bbox = convertBoundingBox(block.bounding_box, image.naturalWidth, image.naturalHeight);
      
      // Scale coordinates to canvas size
      const scaleX = canvas.width / image.naturalWidth;
      const scaleY = canvas.height / image.naturalHeight;
      
      const scaledBox = {
        x: bbox.x * scaleX,
        y: bbox.y * scaleY,
        width: bbox.width * scaleX,
        height: bbox.height * scaleY
      };

      // Set stroke style based on confidence
      ctx.strokeStyle = getConfidenceColor(block.confidence);
      ctx.lineWidth = highlightLowConfidence && block.confidence < 0.8 ? 3 : 2;
      ctx.setLineDash(block.confidence < 0.8 ? [5, 5] : []);

      // Draw bounding box
      ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);

      // Draw confidence score if enabled
      if (showConfidence) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(scaledBox.x, scaledBox.y - 20, 60, 18);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(
          `${(block.confidence * 100).toFixed(0)}%`,
          scaledBox.x + 2,
          scaledBox.y - 6
        );
      }

      // Highlight hovered block
      if (hoveredBlock && hoveredBlock.block_id === block.block_id) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.strokeRect(scaledBox.x - 2, scaledBox.y - 2, scaledBox.width + 4, scaledBox.height + 4);
      }
    });

    ctx.setLineDash([]); // Reset line dash
  };

  // Handle image load
  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;

    // Set canvas dimensions to match image aspect ratio
    const maxWidth = 1200;
    const maxHeight = 800;
    
    let { naturalWidth, naturalHeight } = image;
    const aspectRatio = naturalWidth / naturalHeight;

    let canvasWidth = Math.min(naturalWidth, maxWidth);
    let canvasHeight = canvasWidth / aspectRatio;

    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight;
      canvasWidth = canvasHeight * aspectRatio;
    }

    setCanvasDimensions({ width: canvasWidth, height: canvasHeight });
    setImageLoaded(true);
  };

  // Handle mouse move for hover detection
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    if (!canvas || !image || !imageLoaded) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scale mouse coordinates to image coordinates
    const scaleX = image.naturalWidth / canvas.width;
    const scaleY = image.naturalHeight / canvas.height;
    
    const imageX = x * scaleX;
    const imageY = y * scaleY;

    // Find which text block contains the mouse position
    const hoveredBlock = ocrResults.detected_text.text_blocks.find((block: TextBlock) => {
      const bbox = convertBoundingBox(block.bounding_box, image.naturalWidth, image.naturalHeight);
      return imageX >= bbox.x && imageX <= bbox.x + bbox.width &&
             imageY >= bbox.y && imageY <= bbox.y + bbox.height &&
             block.confidence >= minConfidence;
    });

    setHoveredBlock(hoveredBlock || null);
  };

  // Effect to redraw when dependencies change
  useEffect(() => {
    drawBoundingBoxes();
  }, [imageLoaded, hoveredBlock, showConfidence, minConfidence, highlightLowConfidence, canvasDimensions]);

  return (
    <div className="ocr-visualization">
      <div className="ocr-header">
        <h2 className="ocr-title">OCR Results Visualization</h2>
        <div className="ocr-stats">
          <strong>Total Blocks:</strong> {ocrResults.extraction_info.total_blocks} | 
          <strong> Average Confidence:</strong> {(ocrResults.extraction_info.average_confidence * 100).toFixed(1)}% | 
          <strong> Processing Time:</strong> {ocrResults.extraction_info.processing_time_seconds}s
        </div>
        
        {/* Controls */}
        <div className="ocr-controls">
          <label className="ocr-control-label">
            <input
              type="checkbox"
              checked={showConfidence}
              onChange={(e) => setShowConfidence(e.target.checked)}
            />
            Show Confidence Scores
          </label>
          
          <label className="ocr-control-label">
            <input
              type="checkbox"
              checked={highlightLowConfidence}
              onChange={(e) => setHoveredBlock(e.target.checked)}
            />
            Highlight Low Confidence
          </label>
          
          <label className="ocr-control-label">
            Min Confidence:
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="ocr-range-input"
            />
            {(minConfidence * 100).toFixed(0)}%
          </label>
        </div>

        {/* Legend */}
        <div className="ocr-legend">
          <div className="ocr-legend-item">
            <div className="ocr-legend-color ocr-legend-color--high"></div>
            High (95%+)
          </div>
          <div className="ocr-legend-item">
            <div className="ocr-legend-color ocr-legend-color--medium"></div>
            Medium (85-94%)
          </div>
          <div className="ocr-legend-item">
            <div className="ocr-legend-color ocr-legend-color--low-medium"></div>
            Low-Medium (70-84%)
          </div>
          <div className="ocr-legend-item">
            <div className="ocr-legend-color ocr-legend-color--low"></div>
            Low (&lt;70%)
          </div>
        </div>
      </div>

      {/* Main visualization area */}
      <div className="ocr-main-content">
        <div className="ocr-canvas-container">
          {/* Hidden image for loading */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="OCR Source"
            className="ocr-hidden-image"
            onLoad={handleImageLoad}
            crossOrigin="anonymous"
          />
          
          {/* Canvas for drawing */}
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredBlock(null)}
            className="ocr-canvas"
          />
          
          {!imageLoaded && (
            <div className="ocr-loading">
              Loading image...
            </div>
          )}
        </div>

        {/* Text block details panel */}
        <div className="ocr-details-panel">
          <h3 className="ocr-details-title">Detected Text Details</h3>
          
          {hoveredBlock ? (
            <div className="ocr-text-details">
              <div className="ocr-detail-row">
                <span className="ocr-detail-label">Block ID:</span> {hoveredBlock.block_id}
              </div>
              <div className="ocr-detail-row">
                <span className="ocr-detail-label">Confidence:</span> {(hoveredBlock.confidence * 100).toFixed(1)}%
              </div>
              <div className="ocr-text-content">
                <span className="ocr-detail-label">Text:</span>
                <div className="ocr-text-display">
                  "{hoveredBlock.text}"
                </div>
              </div>
              <div className="ocr-coordinates">
                <span className="ocr-coordinates-label">Coordinates:</span>
                {hoveredBlock.bounding_box.map((point, idx) => 
                  `(${point[0]}, ${point[1]})`
                ).join(' → ')}
              </div>
            </div>
          ) : (
            <div className="ocr-text-details ocr-text-details--placeholder">
              Hover over a text block to see details
            </div>
          )}

          {/* Statistics */}
          <div className="ocr-statistics">
            <h4 className="ocr-statistics-title">Statistics</h4>
            <div className="ocr-stat-row">Total blocks: {ocrResults.detected_text.text_blocks.length}</div>
            <div className="ocr-stat-row">Visible blocks: {ocrResults.detected_text.text_blocks.filter(b => b.confidence >= minConfidence).length}</div>
            <div className="ocr-stat-row">High confidence (&gt;95%): {ocrResults.detected_text.text_blocks.filter(b => b.confidence > 0.95).length}</div>
            <div className="ocr-stat-row">Low confidence (&lt;70%): {ocrResults.detected_text.text_blocks.filter(b => b.confidence < 0.7).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRVisualization;