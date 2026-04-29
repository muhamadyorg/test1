import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  getListCatalogsQueryKey, 
  getListProductsQueryKey,
  getGetCatalogQueryKey,
  getGetCatalogBreadcrumbQueryKey 
} from "@workspace/api-client-react";

export function useWebSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      
      ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          const catalogEvents = ["catalog_created", "catalog_updated", "catalog_deleted", "catalog_moved"];
          const productEvents = ["product_created", "product_updated", "product_deleted", "product_moved", "products_bulk_deleted", "products_bulk_moved"];

          if (catalogEvents.includes(data.type)) {
            queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
            const id = data.catalog?.id || data.id;
            if (id) {
              queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey(id) });
              queryClient.invalidateQueries({ queryKey: getGetCatalogBreadcrumbQueryKey(id) });
            }
          } else if (productEvents.includes(data.type)) {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          }
        } catch (_e) {
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [queryClient]);

  return { isConnected };
}
