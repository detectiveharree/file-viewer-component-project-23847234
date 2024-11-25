import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize,
  Ruler,
  MessageSquare,
  Save,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
}

interface Position {
  x: number;
  y: number;
}

const BASE_SCALE = 1.0; // Changed from 2.0 to 1.0
const PADDING = 20; // Consistent padding value
const MAX_SCALE = 5;
const MIN_SCALE_FACTOR = 0.5;

export function DocumentViewerModal({
  isOpen,
  onClose,
  fileUrl,
}: DocumentViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitScale, setFitScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const startPanRef = useRef<Position>({ x: 0, y: 0 });
  const panOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const lastTransformRef = useRef<Position>({ x: 0, y: 0 });
  const [activeMode, setActiveMode] = useState<string>("drag");

  const getPdfUrl = (url: string) => url;

  const calculateFitScale = () => {
    if (containerRef.current && pageRef.current && !isLoading) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const pageWidth = pageRef.current.scrollWidth;
      const pageHeight = pageRef.current.scrollHeight;

      // Calculate scales with padding
      const scaleWidth = (containerWidth - PADDING * 2) / pageWidth;
      const scaleHeight = (containerHeight - PADDING * 2) / pageHeight;

      // Use the smaller scale to ensure the page fits both dimensions
      const newFitScale = Math.min(scaleWidth, scaleHeight);

      setFitScale(newFitScale);
      setScale(newFitScale);

      // Calculate centered position
      const scaledWidth = pageWidth * newFitScale;
      const scaledHeight = pageHeight * newFitScale;

      const xOffset = (containerWidth - scaledWidth) / 2;
      const yOffset = (containerHeight - scaledHeight) / 2;

      // Update positions
      panOffsetRef.current = { x: xOffset, y: yOffset };
      lastTransformRef.current = { x: xOffset, y: yOffset };

      updateTransform(newFitScale);
    }
  };

  // Reset component state when closed
  useEffect(() => {
    if (!isOpen) {
      setNumPages(0);
      setPageNumber(1);
      setScale(1.0);
      setFitScale(1.0);
      setError(null);
      setIsLoading(true);
      panOffsetRef.current = { x: 0, y: 0 };
      lastTransformRef.current = { x: 0, y: 0 };
    }
  }, [isOpen]);

  // Calculate fit scale when loading completes
  useEffect(() => {
    if (!isLoading) {
      calculateFitScale();
    }
  }, [isLoading]);

  // Recalculate on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        if (!isLoading) {
          calculateFitScale();
        }
      });

      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
  }, [isLoading]);

  const updateTransform = (newScale: number, zoomOrigin?: Position) => {
    if (viewerRef.current && containerRef.current && pageRef.current) {
      if (zoomOrigin) {
        const container = containerRef.current.getBoundingClientRect();
        const viewer = viewerRef.current.getBoundingClientRect();

        const relativeX = (zoomOrigin.x - container.left) / container.width;
        const relativeY = (zoomOrigin.y - container.top) / container.height;

        const oldWidth = viewer.width / scale;
        const newWidth = viewer.width / newScale;
        const oldHeight = viewer.height / scale;
        const newHeight = viewer.height / newScale;

        panOffsetRef.current = {
          x: panOffsetRef.current.x + (newWidth - oldWidth) * relativeX,
          y: panOffsetRef.current.y + (newHeight - oldHeight) * relativeY,
        };
      }

      viewerRef.current.style.transform = `translate(${panOffsetRef.current.x}px, ${panOffsetRef.current.y}px) scale(${newScale})`;
    }
  };

  const handleWheel = (e: WheelEvent) => {
    if ((e.ctrlKey || e.metaKey) && isFocused) {
      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY;
      const zoomFactor = 1.1;

      const container = containerRef.current;
      const viewer = viewerRef.current;

      if (container && viewer) {
        const containerRect = container.getBoundingClientRect();
        const viewerRect = viewer.getBoundingClientRect();

        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        const pointXBeforeZoom = (mouseX - panOffsetRef.current.x) / scale;
        const pointYBeforeZoom = (mouseY - panOffsetRef.current.y) / scale;

        const newScale =
          delta > 0
            ? Math.min(5, scale * zoomFactor)
            : Math.max(fitScale * 0.5, scale / zoomFactor);

        const pointXAfterZoom = pointXBeforeZoom * newScale;
        const pointYAfterZoom = pointYBeforeZoom * newScale;

        panOffsetRef.current = {
          x: mouseX - pointXAfterZoom,
          y: mouseY - pointYAfterZoom,
        };

        setScale(newScale);
        updateTransform(newScale);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX, y: e.clientY };
      lastTransformRef.current = { ...panOffsetRef.current };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - startPanRef.current.x;
      const deltaY = e.clientY - startPanRef.current.y;

      panOffsetRef.current = {
        x: lastTransformRef.current.x + deltaX,
        y: lastTransformRef.current.y + deltaY,
      };

      updateTransform(scale);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setScale(fitScale);
    panOffsetRef.current = { x: 0, y: 0 };
    lastTransformRef.current = { x: 0, y: 0 };
    updateTransform(fitScale);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      container.addEventListener("keydown", (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && isFocused) {
          e.preventDefault();
        }
      });

      return () => {
        container.removeEventListener("wheel", handleWheel);
      };
    }
  }, [isFocused, scale]);

  const handleZoomIn = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const newScale = Math.min(5, scale * 1.1);
      setScale(newScale);
      updateTransform(newScale, { x: centerX, y: centerY });
    }
  };

  const handleZoomOut = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const newScale = Math.max(fitScale * 0.5, scale / 1.1);
      setScale(newScale);
      updateTransform(newScale, { x: centerX, y: centerY });
    }
  };

  const getCursorStyle = () => {
    if (isPanning) return "grabbing";
    switch (activeMode) {
      case "drag":
        return "grab";
      case "ruler":
        return "crosshair";
      case "comment":
        return "text";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden flex flex-col">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
            <DialogDescription>
              View and navigate through the document
            </DialogDescription>
          </DialogHeader>
        </div>
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative cursor-grab outline-none bg-gray-50"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseEnter={() => setIsFocused(true)}
          onMouseLeave={() => setIsFocused(false)}
          tabIndex={0}
          style={{ cursor: getCursorStyle() }}
        >
          {error ? (
            <div className="text-red-500">{error}</div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-8 h-8 bg-teal-400 rounded-full"></div>
                    <div className="w-8 h-8 bg-teal-400 rounded-full"></div>
                    <div className="w-8 h-8 bg-teal-400 rounded-full"></div>
                  </div>
                </div>
              )}
              <div
                ref={viewerRef}
                className="absolute inset-0 flex items-center justify-center origin-top-left"
                style={{
                  visibility: isLoading ? "hidden" : "visible",
                }}
              >
                <div ref={pageRef} className="pdf-page">
                  <Document
                    file={fileUrl}
                    onLoadSuccess={({ numPages }) => {
                      setNumPages(numPages);
                      setError(null);
                    }}
                    onLoadError={(error) => {
                      console.error("Error loading PDF:", error);
                      setError(`Failed to load document: ${error.message}`);
                      setIsLoading(false);
                    }}
                    loading={null}
                    options={{
                      cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
                      cMapPacked: true,
                      withCredentials: false, // Add this
                    }}
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={BASE_SCALE}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onLoadSuccess={() => setIsLoading(false)}
                      loading={null}
                    />
                  </Document>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-between items-center p-4 bg-gray-100">
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setPageNumber((prev) => Math.max(1, prev - 1))
                    }
                    disabled={pageNumber <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous page</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm">
              Page {pageNumber} of {numPages}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setPageNumber((prev) => Math.min(numPages, prev + 1))
                    }
                    disabled={pageNumber >= numPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next page</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 flex justify-center items-center space-x-4">
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomOut}
                      disabled={scale <= fitScale * MIN_SCALE_FACTOR}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-sm w-16 text-center">
                {Math.round((scale / fitScale) * 100)}%
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomIn}
                      disabled={scale >= MAX_SCALE}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom in</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetView}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset view</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ToggleGroup
              type="single"
              value={activeMode}
              onValueChange={setActiveMode}
              className="border rounded-md"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="drag"
                      className="px-3 py-2 relative"
                    >
                      <div
                        className={cn(
                          "absolute inset-0 rounded-full transition-colors",
                          activeMode === "drag"
                            ? "bg-cyan-500"
                            : "bg-transparent"
                        )}
                      />
                      <Move
                        className={cn(
                          "h-4 w-4 relative z-10",
                          activeMode === "drag"
                            ? "text-white"
                            : "text-foreground"
                        )}
                      />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Drag</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="ruler"
                      className="px-3 py-2 relative"
                    >
                      <div
                        className={cn(
                          "absolute inset-0 rounded-full transition-colors",
                          activeMode === "ruler"
                            ? "bg-cyan-500"
                            : "bg-transparent"
                        )}
                      />
                      <Ruler
                        className={cn(
                          "h-4 w-4 relative z-10",
                          activeMode === "ruler"
                            ? "text-white"
                            : "text-foreground"
                        )}
                      />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Measure distance</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="comment"
                      className="px-3 py-2 relative"
                    >
                      <div
                        className={cn(
                          "absolute inset-0 rounded-full transition-colors",
                          activeMode === "comment"
                            ? "bg-cyan-500"
                            : "bg-transparent"
                        )}
                      />
                      <MessageSquare
                        className={cn(
                          "h-4 w-4 relative z-10",
                          activeMode === "comment"
                            ? "text-white"
                            : "text-foreground"
                        )}
                      />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Comment</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </ToggleGroup>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save comments</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div>
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost">Go to</Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Jump to specific sections</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem>Table of Contents</DropdownMenuItem>
                <DropdownMenuItem>Bookmarks</DropdownMenuItem>
                <DropdownMenuItem>Annotations</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
