"use client";

import { useState, useMemo, forwardRef, useEffect, useRef } from "react";
import { Graph, GraphRef } from "@/components/graph/Graph";
import { GraphPopovers } from "@/components/graph/GraphPopovers";
import type {
  RawTriplet,
  NodePopupContent,
  EdgePopupContent,
} from "@/lib/types/graph";
import { toGraphTriplets } from "@/lib/utils/graph";
import { createLabelColorMap, getNodeColor } from "@/lib/utils/nodeColors";
import { useTheme } from "next-themes";
import { Search, X, Check } from "lucide-react";

interface GraphVisualizationProps {
  triplets: RawTriplet[];
  width?: number;
  height?: number;
  zoomOnMount?: boolean;
  className?: string;
}

// eslint-disable-next-line react/display-name
export const GraphVisualization = forwardRef<GraphRef, GraphVisualizationProps>(
  (
    {
      triplets,
      width: propWidth,
      height: propHeight,
      zoomOnMount = true,
      className = "border border-border rounded-md h-[85vh] overflow-hidden relative",
    },
    ref
  ) => {
    const { resolvedTheme } = useTheme();
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    // Use state for dimensions to avoid SSR hydration mismatch
    const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
    
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<Array<{ type: "node" | "edge"; id: string; name: string; label?: string }>>([]);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    
    // Filter state - by default all types are selected
    const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<string>>(new Set());
    const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<Set<string>>(new Set());
    const [nodeTypesInitialized, setNodeTypesInitialized] = useState(false);
    const [edgeTypesInitialized, setEdgeTypesInitialized] = useState(false);
    
    useEffect(() => {
      // Set dimensions on client side only
      setDimensions({
        width: propWidth ?? window.innerWidth * 0.85,
        height: propHeight ?? window.innerHeight * 0.85,
      });
    }, [propWidth, propHeight]);
    
    // Focus search input when opened
    useEffect(() => {
      if (searchOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [searchOpen]);

    // Keyboard shortcut for search (Ctrl+F)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault();
          setSearchOpen(true);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    
    const width = propWidth ?? dimensions.width;
    const height = propHeight ?? dimensions.height;
    const isDarkMode = resolvedTheme === "dark";

    // Graph state for popovers
    const [showNodePopup, setShowNodePopup] = useState<boolean>(false);
    const [showEdgePopup, setShowEdgePopup] = useState<boolean>(false);
    const [nodePopupContent, setNodePopupContent] =
      useState<NodePopupContent | null>(null);
    const [edgePopupContent, setEdgePopupContent] =
      useState<EdgePopupContent | null>(null);

    // Convert raw triplets to graph triplets
    const graphTriplets = useMemo(() => toGraphTriplets(triplets), [triplets]);

    // Extract all unique labels from triplets
    const allLabels = useMemo(() => {
      const labels = new Set<string>();
      labels.add("Entity"); // Always include Entity as default

      graphTriplets.forEach((triplet) => {
        if (triplet.source.primaryLabel)
          labels.add(triplet.source.primaryLabel);
        if (triplet.target.primaryLabel)
          labels.add(triplet.target.primaryLabel);
      });

      return Array.from(labels).sort((a, b) => {
        // Always put "Entity" first
        if (a === "Entity") return -1;
        if (b === "Entity") return 1;
        // Sort others alphabetically
        return a.localeCompare(b);
      });
    }, [graphTriplets]);

    // Extract all unique edge types from triplets (both type and name fields)
    const allEdgeTypes = useMemo(() => {
      const edgeTypes = new Set<string>();

      graphTriplets.forEach((triplet) => {
        // Skip isolated node placeholder edges
        if (triplet.relation.type === "_isolated_node_") return;
        
        // Add the relationship type if it exists and is meaningful
        if (triplet.relation.type && triplet.relation.type.trim()) {
          edgeTypes.add(triplet.relation.type);
        }
        
        // Add the edge name if it exists, is meaningful, and different from type
        if (triplet.relation.name && triplet.relation.name.trim()) {
          // Only add if different from type (avoid duplicates)
          if (triplet.relation.name !== triplet.relation.type) {
            edgeTypes.add(triplet.relation.name);
          }
        }
      });

      return Array.from(edgeTypes).sort((a, b) => a.localeCompare(b));
    }, [graphTriplets]);

    // Initialize selected node types when allLabels changes
    useEffect(() => {
      if (allLabels.length > 0 && !nodeTypesInitialized) {
        setSelectedNodeTypes(new Set(allLabels));
        setNodeTypesInitialized(true);
      }
    }, [allLabels, nodeTypesInitialized]);

    // Initialize selected edge types when allEdgeTypes changes
    useEffect(() => {
      if (allEdgeTypes.length > 0 && !edgeTypesInitialized) {
        setSelectedEdgeTypes(new Set(allEdgeTypes));
        setEdgeTypesInitialized(true);
      }
    }, [allEdgeTypes, edgeTypesInitialized]);

    // Reset filters when triplets change significantly
    useEffect(() => {
      setNodeTypesInitialized(false);
      setEdgeTypesInitialized(false);
    }, [triplets]);

    // Toggle node type filter
    const toggleNodeType = (label: string) => {
      setSelectedNodeTypes((prev) => {
        const next = new Set(prev);
        if (next.has(label)) {
          next.delete(label);
        } else {
          next.add(label);
        }
        return next;
      });
    };

    // Toggle edge type filter
    const toggleEdgeType = (edgeType: string) => {
      setSelectedEdgeTypes((prev) => {
        const next = new Set(prev);
        if (next.has(edgeType)) {
          next.delete(edgeType);
        } else {
          next.add(edgeType);
        }
        return next;
      });
    };

    // Select/deselect all node types
    const toggleAllNodeTypes = () => {
      if (selectedNodeTypes.size === allLabels.length) {
        setSelectedNodeTypes(new Set());
      } else {
        setSelectedNodeTypes(new Set(allLabels));
      }
    };

    // Select/deselect all edge types
    const toggleAllEdgeTypes = () => {
      if (selectedEdgeTypes.size === allEdgeTypes.length) {
        setSelectedEdgeTypes(new Set());
      } else {
        setSelectedEdgeTypes(new Set(allEdgeTypes));
      }
    };

    // Filter graph triplets based on selected types
    const filteredGraphTriplets = useMemo(() => {
      return graphTriplets.filter((triplet) => {
        // Check if source node type is selected
        const sourceLabel = triplet.source.primaryLabel || "Entity";
        if (!selectedNodeTypes.has(sourceLabel)) return false;

        // Check if target node type is selected
        const targetLabel = triplet.target.primaryLabel || "Entity";
        if (!selectedNodeTypes.has(targetLabel)) return false;

        // For isolated node placeholders, only check node types
        if (triplet.relation.type === "_isolated_node_") return true;

        // Check if edge type is selected (check both type and name)
        const edgeType = triplet.relation.type;
        const edgeName = triplet.relation.name;
        const edgeTypeSelected = edgeType && selectedEdgeTypes.has(edgeType);
        const edgeNameSelected = edgeName && edgeName !== edgeType && selectedEdgeTypes.has(edgeName);
        
        return edgeTypeSelected || edgeNameSelected;
      });
    }, [graphTriplets, selectedNodeTypes, selectedEdgeTypes]);

    // Create a shared label color map
    const sharedLabelColorMap = useMemo(() => {
      return createLabelColorMap(allLabels);
    }, [allLabels]);

    // Search through nodes and edges - search in original triplets for better data access
    useEffect(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setSelectedResultIndex(0);
        return;
      }

      const query = searchQuery.toLowerCase();
      const results: Array<{ type: "node" | "edge"; id: string; name: string; label?: string }> = [];
      const seenNodes = new Set<string>();
      const seenEdges = new Set<string>();

      // Search nodes from original triplets
      triplets.forEach((triplet) => {
        // Check source node
        if (!seenNodes.has(triplet.sourceNode.uuid)) {
          const nodeName = triplet.sourceNode.name || "";
          const nodeLabels = triplet.sourceNode.labels?.join(" ") || "";
          const searchText = `${nodeName} ${nodeLabels}`.toLowerCase();
          
          if (searchText.includes(query)) {
            results.push({
              type: "node",
              id: triplet.sourceNode.uuid,
              name: nodeName,
              label: triplet.sourceNode.labels?.[0],
            });
            seenNodes.add(triplet.sourceNode.uuid);
          }
        }

        // Check target node
        if (!seenNodes.has(triplet.targetNode.uuid)) {
          const nodeName = triplet.targetNode.name || "";
          const nodeLabels = triplet.targetNode.labels?.join(" ") || "";
          const searchText = `${nodeName} ${nodeLabels}`.toLowerCase();
          
          if (searchText.includes(query)) {
            results.push({
              type: "node",
              id: triplet.targetNode.uuid,
              name: nodeName,
              label: triplet.targetNode.labels?.[0],
            });
            seenNodes.add(triplet.targetNode.uuid);
          }
        }

        // Check edge
        if (triplet.edge.type !== "_isolated_node_" && !seenEdges.has(triplet.edge.uuid)) {
          const edgeName = triplet.edge.name || triplet.edge.type || "";
          if (edgeName.toLowerCase().includes(query)) {
            results.push({
              type: "edge",
              id: triplet.edge.uuid,
              name: edgeName,
              label: triplet.edge.type,
            });
            seenEdges.add(triplet.edge.uuid);
          }
        }
      });

      // Limit results for performance
      setSearchResults(results.slice(0, 50));
      setSelectedResultIndex(0);
    }, [searchQuery, triplets]);

    // Handle search result selection
    const handleSearchSelect = (result: { type: "node" | "edge"; id: string }) => {
      if (result.type === "node") {
        handleNodeClick(result.id);
      } else {
        handleEdgeClick(result.id);
      }
      setSearchOpen(false);
      setSearchQuery("");
    };

    // Handle keyboard navigation in search
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedResultIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && searchResults[selectedResultIndex]) {
        e.preventDefault();
        handleSearchSelect(searchResults[selectedResultIndex]);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };

    // Handle node click
    const handleNodeClick = (nodeId: string) => {
      // Find the triplet that contains this node
      const triplet = triplets.find(
        (t) => t.sourceNode.uuid === nodeId || t.targetNode.uuid === nodeId
      );

      if (!triplet) return;

      // Determine which node was clicked (source or target)
      const node =
        triplet.sourceNode.uuid === nodeId
          ? triplet.sourceNode
          : triplet.targetNode;

      // Set popup content and show the popup
      setNodePopupContent({
        id: nodeId,
        node: node,
      });
      setShowNodePopup(true);
      setShowEdgePopup(false);
    };

    // Handle edge click
    const handleEdgeClick = (edgeId: string) => {
      // Find the triplet that contains this edge
      const triplet = triplets.find((t) => t.edge.uuid === edgeId);

      if (!triplet) return;

      // Set popup content and show the popup
      setEdgePopupContent({
        id: edgeId,
        source: triplet.sourceNode,
        target: triplet.targetNode,
        relation: triplet.edge,
      });
      setShowEdgePopup(true);
      setShowNodePopup(false);
    };

    // Handle popover close
    const handlePopoverClose = () => {
      setShowNodePopup(false);
      setShowEdgePopup(false);
    };
    return (
      <div className={className}>
        {/* Entity Types Legend - Top Left */}
        <div className="absolute top-4 left-4 z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 max-w-[220px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Node Labels ({selectedNodeTypes.size}/{allLabels.length})
            </h4>
            <button
              onClick={toggleAllNodeTypes}
              className="text-xs text-primary hover:underline"
            >
              {selectedNodeTypes.size === allLabels.length ? "None" : "All"}
            </button>
          </div>
          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-2">
            {allLabels.map((label) => (
              <button
                key={label}
                onClick={() => toggleNodeType(label)}
                className={`w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted transition-colors ${
                  selectedNodeTypes.has(label) ? "" : "opacity-40"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedNodeTypes.has(label)
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {selectedNodeTypes.has(label) && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getNodeColor(
                      label,
                      isDarkMode,
                      sharedLabelColorMap
                    ),
                  }}
                />
                <span className="text-xs truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Panel - Top Center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          {searchOpen ? (
            <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 w-[300px]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search nodes and edges..."
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-[200px] overflow-y-auto border-t border-border pt-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}-${index}`}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                        index === selectedResultIndex
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleSearchSelect(result)}
                    >
                      {result.type === "node" ? (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getNodeColor(
                              result.label || null,
                              isDarkMode,
                              sharedLabelColorMap
                            ),
                          }}
                        />
                      ) : (
                        <div className="w-3 h-0.5 bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{result.name}</span>
                      {result.label && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {result.label}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="mt-2 text-sm text-muted-foreground text-center py-2 border-t border-border">
                  No results found
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search</span>
              <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Ctrl+F
              </kbd>
            </button>
          )}
        </div>

        {/* Edge Types Legend - Top Right */}
        <div className="absolute top-4 right-4 z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 max-w-[240px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Edge Types ({selectedEdgeTypes.size}/{allEdgeTypes.length})
            </h4>
            <button
              onClick={toggleAllEdgeTypes}
              className="text-xs text-primary hover:underline"
            >
              {selectedEdgeTypes.size === allEdgeTypes.length ? "None" : "All"}
            </button>
          </div>
          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-2">
            {allEdgeTypes.map((edgeType) => (
              <button
                key={edgeType}
                onClick={() => toggleEdgeType(edgeType)}
                className={`w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted transition-colors ${
                  selectedEdgeTypes.has(edgeType) ? "" : "opacity-40"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedEdgeTypes.has(edgeType)
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {selectedEdgeTypes.has(edgeType) && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <div className="w-4 h-0.5 bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                <span className="text-xs font-mono truncate">{edgeType}</span>
              </button>
            ))}
            {allEdgeTypes.length === 0 && (
              <span className="text-xs text-muted-foreground">No edge types found</span>
            )}
          </div>
        </div>

        {triplets.length > 0 ? (
          filteredGraphTriplets.length > 0 ? (
            <Graph
              ref={ref}
              triplets={filteredGraphTriplets}
              width={width}
              height={height}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onBlur={handlePopoverClose}
              zoomOnMount={zoomOnMount}
              labelColorMap={sharedLabelColorMap}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No nodes/edges match the current filters.</p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No graph data to visualize.</p>
          </div>
        )}
        <GraphPopovers
          showNodePopup={showNodePopup}
          showEdgePopup={showEdgePopup}
          nodePopupContent={nodePopupContent}
          edgePopupContent={edgePopupContent}
          onOpenChange={handlePopoverClose}
          labelColorMap={sharedLabelColorMap}
        />
      </div>
    );
  }
);
