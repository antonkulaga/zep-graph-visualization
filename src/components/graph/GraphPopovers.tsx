"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { NodePopupContent, EdgePopupContent } from "@/lib/types/graph";
import { getNodeColor } from "@/lib/utils/nodeColors";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { formatDate } from "@/lib/utils/dates";

interface GraphPopoversProps {
  showNodePopup: boolean;
  showEdgePopup: boolean;
  nodePopupContent: NodePopupContent | null;
  edgePopupContent: EdgePopupContent | null;
  onOpenChange?: (open: boolean) => void;
  labelColorMap?: Map<string, number>;
}

export function GraphPopovers({
  showNodePopup,
  showEdgePopup,
  nodePopupContent,
  edgePopupContent,
  onOpenChange,
  labelColorMap,
}: GraphPopoversProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  const primaryNodeLabel = useMemo((): string | null => {
    if (!nodePopupContent) {
      return null;
    }

    // Check if node has primaryLabel property (GraphNode)
    const nodeAny = nodePopupContent.node as any;
    if (nodeAny.primaryLabel && typeof nodeAny.primaryLabel === "string") {
      return nodeAny.primaryLabel;
    }

    // Fall back to original logic with labels
    const primaryLabel = nodePopupContent.node.labels?.find(
      (label) => label !== "Entity"
    );
    return primaryLabel || "Entity";
  }, [nodePopupContent]);

  // Get the color for the primary label
  const labelColor = useMemo(() => {
    if (!primaryNodeLabel || !labelColorMap) return "";
    return getNodeColor(primaryNodeLabel, isDarkMode, labelColorMap);
  }, [primaryNodeLabel, isDarkMode, labelColorMap]);

  const attributesToDisplay = useMemo(() => {
    if (!nodePopupContent) {
      return [];
    }
    
    // Helper to check if a value is an embedding (array of numbers)
    const isEmbedding = (value: unknown): boolean => {
      if (!Array.isArray(value)) return false;
      if (value.length === 0) return false;
      // Check if it's a large array of numbers (typical for embeddings)
      if (value.length > 10 && typeof value[0] === "number") return true;
      return false;
    };
    
    // Filter out labels, embedding properties, and large numeric arrays
    const entityProperties = Object.fromEntries(
      Object.entries(nodePopupContent.node.attributes || {}).filter(
        ([key, value]) => {
          // Exclude labels
          if (key === "labels") return false;
          // Exclude properties with "embedding" in the name (case-insensitive)
          if (key.toLowerCase().includes("embedding")) return false;
          // Exclude properties with "vector" in the name (case-insensitive)
          if (key.toLowerCase().includes("vector")) return false;
          // Exclude large numeric arrays (embeddings)
          if (isEmbedding(value)) return false;
          return true;
        }
      )
    );

    return Object.entries(entityProperties).map(([key, value]) => ({
      key,
      value,
    }));
  }, [nodePopupContent]);

  return (
    <div className="absolute top-4 right-4 z-50">
      <Popover open={showNodePopup} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div className="w-4 h-4 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent
          className="w-96 p-0"
          side="bottom"
          align="end"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h4 className="font-medium leading-none">Node Details</h4>
            {primaryNodeLabel && (
              <span
                className="text-xs px-2 py-1 rounded-full text-white font-medium"
                style={{ backgroundColor: labelColor }}
              >
                {primaryNodeLabel}
              </span>
            )}
          </div>
          <div
            className="max-h-[60vh] overflow-y-auto p-4"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(155, 155, 155, 0.5) transparent",
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground break-all">
                <span className="text-sm text-black font-medium dark:text-white mr-2">
                  Name:
                </span>
                {nodePopupContent?.node.name || "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground break-words">
                <span className="text-sm text-black font-medium dark:text-white mr-2">
                  UUID:
                </span>
                {nodePopupContent?.node.uuid || "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground break-words">
                <span className="text-sm text-black font-medium dark:text-white mr-2">
                  Created:
                </span>
                {nodePopupContent?.node.created_at &&
                  formatDate(nodePopupContent?.node.created_at)}
              </p>

              {attributesToDisplay.length > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="text-sm font-medium text-black dark:text-white mb-2">
                    Properties:
                  </p>
                  <div className="space-y-1.5">
                    {attributesToDisplay.map(({ key, value }) => (
                      <p key={key} className="text-sm">
                        <span className="font-medium text-black dark:text-white">
                          {key}:
                        </span>{" "}
                        <span className="text-muted-foreground break-words">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {nodePopupContent?.node.summary && (
                <div className="border-t border-border pt-2">
                  <p className="text-sm font-medium text-black dark:text-white mb-1">
                    Summary:
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    {nodePopupContent.node.summary}
                  </p>
                </div>
              )}

              {nodePopupContent?.node.labels?.length ? (
                <div className="border-t border-border pt-2">
                  <p className="text-sm font-medium text-black dark:text-white mb-1">
                    Labels:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {nodePopupContent.node.labels.map((label) => (
                      <span
                        key={label}
                        className="text-xs bg-muted px-2 py-1 rounded-md"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={showEdgePopup} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div className="w-4 h-4 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent
          className="w-96 p-0"
          side="bottom"
          align="end"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-4 border-b border-border">
            <h4 className="font-medium leading-none mb-2">Relationship</h4>
            <div className="p-2 bg-muted rounded-md">
              <p className="text-sm break-all">
                {edgePopupContent?.source.name || "Unknown"} →{" "}
                <span className="font-medium">
                  {edgePopupContent?.relation.name || "Unknown"}
                </span>{" "}
                → {edgePopupContent?.target.name || "Unknown"}
              </p>
            </div>
          </div>
          <div
            className="max-h-[60vh] overflow-y-auto p-4"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(155, 155, 155, 0.5) transparent",
            }}
          >
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground break-all">
                <span className="text-sm font-medium text-black dark:text-white mr-2">
                  UUID:
                </span>
                {edgePopupContent?.relation.uuid || "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground break-all">
                <span className="text-sm font-medium text-black dark:text-white mr-2">
                  Type:
                </span>
                {edgePopupContent?.relation.name || "Unknown"}
              </p>
              {edgePopupContent?.relation.fact && (
                <p className="text-sm text-muted-foreground break-all">
                  <span className="text-sm font-medium text-black dark:text-white mr-2">
                    Fact:
                  </span>
                  {edgePopupContent.relation.fact}
                </p>
              )}
              {edgePopupContent?.relation.episodes?.length ? (
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">
                    Episodes:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {edgePopupContent.relation.episodes.map((episode) => (
                      <span
                        key={episode}
                        className="text-xs bg-muted px-2 py-1 rounded-md"
                      >
                        {episode}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground break-all">
                <span className="text-sm font-medium text-black dark:text-white mr-2">
                  Created:
                </span>
                {formatDate(edgePopupContent?.relation.created_at)}
              </p>
              {edgePopupContent?.relation.valid_at && (
                <p className="text-sm text-muted-foreground break-all">
                  <span className="text-sm font-medium text-black dark:text-white mr-2">
                    Valid From:
                  </span>
                  {formatDate(edgePopupContent.relation.valid_at)}
                </p>
              )}
              {edgePopupContent?.relation.expired_at && (
                <p className="text-sm text-muted-foreground break-all">
                  <span className="text-sm font-medium text-black dark:text-white mr-2">
                    Expired At:
                  </span>
                  {formatDate(edgePopupContent.relation.expired_at)}
                </p>
              )}
              {edgePopupContent?.relation.invalid_at && (
                <p className="text-sm text-muted-foreground break-all">
                  <span className="text-sm font-medium text-black dark:text-white mr-2">
                    Invalid At:
                  </span>
                  {formatDate(edgePopupContent.relation.invalid_at)}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
