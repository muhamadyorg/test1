import { useState, useRef, useCallback } from "react";
import {
  useListCatalogs,
  useListProducts,
  useGetCatalogBreadcrumb,
  useCreateCatalog,
  useCreateProduct,
  useUpdateCatalog,
  useUpdateProduct,
  useDeleteCatalog,
  useDeleteProduct,
  useBulkDeleteProducts,
  getListCatalogsQueryKey,
  getListProductsQueryKey,
  getGetCatalogBreadcrumbQueryKey,
  getGetCatalogQueryKey,
  Catalog,
  Product,
} from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Package,
  Plus,
  ChevronRight,
  LayoutGrid,
  Grid3X3,
  List as ListIcon,
  Camera,
  MoreVertical,
  Edit,
  Trash,
  FolderPlus,
  PackagePlus,
  PackageSearch,
  X,
  Tag,
  Palette,
  Hash,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewSize = "small" | "medium" | "large";
type Attr = { key: string; value: string };

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  const { url } = await res.json();
  return url;
}

function ImageUpload({
  value,
  onChange,
  label,
  className = "",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const url = await uploadImage(file);
        onChange(url);
      } catch {
        onChange(null);
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <div
        className="relative aspect-square w-full max-w-[180px] mx-auto rounded-xl border-2 border-dashed border-border hover:border-primary/60 transition-colors cursor-pointer overflow-hidden bg-secondary/30 flex items-center justify-center group"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-8 w-8 text-white" />
            </div>
            <button
              type="button"
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center pointer-events-none">
            {uploading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Camera className="h-8 w-8" />
            )}
            <span className="text-xs">
              {uploading ? "Yuklanmoqda..." : "Rasm tanlash"}
            </span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ColorInput({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !colors.includes(v)) onChange([...colors, v]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder="Masalan: Qizil, Ko'k..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-3 shrink-0" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {colors.map((c) => (
            <Badge
              key={c}
              variant="secondary"
              className="gap-1 pr-1 cursor-default text-xs"
            >
              <Palette className="h-3 w-3" />
              {c}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors"
                onClick={() => onChange(colors.filter((x) => x !== c))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetailDialog({
  product,
  open,
  onClose,
  onEdit,
  isAdmin,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  isAdmin: boolean;
}) {
  if (!product) return null;

  const attrs = (product.attributes as Attr[]) ?? [];
  const colors = attrs.filter((a) => a.key === "Rang").map((a) => a.value);
  const otherAttrs = attrs.filter((a) => a.key !== "Rang");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        {/* Image — big on top */}
        <div className="relative w-full aspect-[4/3] bg-secondary/40 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-16 w-16 text-muted-foreground/30" />
          )}
          <button
            className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            onClick={onClose}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-white hover:bg-primary/80 transition-colors text-xs font-medium"
              onClick={onEdit}
            >
              <Edit className="h-3.5 w-3.5" />
              Tahrirlash
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-5 space-y-4">
          {/* Name + price */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">{product.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-mono">{product.productId}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-primary">
                {Number(product.price).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">so'm</p>
            </div>
          </div>

          {/* Colors */}
          {colors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Ranglar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-xs px-3 py-1 rounded-full border-border/60 bg-secondary/50"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Other attributes */}
          {otherAttrs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Xususiyatlar</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {otherAttrs.map((a, i) => (
                  <div
                    key={i}
                    className="bg-secondary/40 rounded-lg px-3 py-2 border border-border/40"
                  >
                    <p className="text-xs text-muted-foreground leading-none mb-1">
                      {a.key}
                    </p>
                    <p className="text-sm font-medium leading-snug">{a.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CatalogBrowser() {
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [viewSize, setViewSize] = useState<ViewSize>("medium");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const [createCatalogOpen, setCreateCatalogOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editCatalog, setEditCatalog] = useState<Catalog | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Create catalog form
  const [newCatalogName, setNewCatalogName] = useState("");
  const [newCatalogImage, setNewCatalogImage] = useState<string | null>(null);

  // Create product form
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newProductImage, setNewProductImage] = useState<string | null>(null);
  const [newProductAttrs, setNewProductAttrs] = useState<Attr[]>([]);
  const [newProductColors, setNewProductColors] = useState<string[]>([]);

  // Edit catalog form
  const [editCatalogName, setEditCatalogName] = useState("");
  const [editCatalogImage, setEditCatalogImage] = useState<string | null>(null);

  // Edit product form
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductCustomId, setEditProductCustomId] = useState("");
  const [editProductImage, setEditProductImage] = useState<string | null>(null);
  const [editProductAttrs, setEditProductAttrs] = useState<Attr[]>([]);
  const [editProductColors, setEditProductColors] = useState<string[]>([]);

  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: catalogs, isLoading: catalogsLoading } = useListCatalogs(
    currentParentId !== null ? { parentId: currentParentId } : {}
  );
  const { data: products, isLoading: productsLoading } = useListProducts(
    { catalogId: currentParentId! },
    {
      query: {
        enabled: currentParentId !== null,
        queryKey: getListProductsQueryKey({ catalogId: currentParentId! }),
      },
    }
  );
  const { data: breadcrumbs } = useGetCatalogBreadcrumb(currentParentId!, {
    query: {
      enabled: currentParentId !== null,
      queryKey: getGetCatalogBreadcrumbQueryKey(currentParentId!),
    },
  });

  const hasCatalogs = (catalogs?.length ?? 0) > 0;
  const hasProducts = (products?.length ?? 0) > 0;

  const createCatalog = useCreateCatalog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setCreateCatalogOpen(false);
        setNewCatalogName("");
        setNewCatalogImage(null);
        toast({ title: "Katalog yaratildi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setCreateProductOpen(false);
        setNewProductName("");
        setNewProductPrice("");
        setNewProductId("");
        setNewProductImage(null);
        setNewProductAttrs([]);
        setNewProductColors([]);
        toast({ title: "Mahsulot yaratildi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const updateCatalog = useUpdateCatalog({
    mutation: {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetCatalogQueryKey(vars.id),
        });
        setEditCatalog(null);
        toast({ title: "Katalog yangilandi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const updateProduct = useUpdateProduct({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setEditProduct(null);
        if (viewProduct?.id === updated.id) setViewProduct(updated);
        toast({ title: "Mahsulot yangilandi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const deleteCatalog = useDeleteCatalog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        toast({ title: "Katalog o'chirildi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setViewProduct(null);
        toast({ title: "Mahsulot o'chirildi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const bulkDeleteProducts = useBulkDeleteProducts({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCatalogsQueryKey() });
        setSelectedProductIds([]);
        toast({ title: "Mahsulotlar o'chirildi" });
      },
      onError: () => toast({ title: "Xato", variant: "destructive" }),
    },
  });

  const handleNavigate = (id: number | null) => {
    setCurrentParentId(id);
    setSelectedProductIds([]);
  };

  const openEditCatalog = (cat: Catalog, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCatalog(cat);
    setEditCatalogName(cat.name);
    setEditCatalogImage(cat.imageUrl ?? null);
  };

  const openEditProduct = (prod: Product) => {
    const attrs = (prod.attributes as Attr[]) ?? [];
    setEditProduct(prod);
    setEditProductName(prod.name);
    setEditProductPrice(String(prod.price));
    setEditProductCustomId(prod.productId);
    setEditProductImage(prod.imageUrl ?? null);
    setEditProductAttrs(attrs.filter((a) => a.key !== "Rang"));
    setEditProductColors(
      attrs.filter((a) => a.key === "Rang").map((a) => a.value)
    );
    setViewProduct(null);
  };

  const buildProductAttrs = (attrs: Attr[], colors: string[]): Attr[] => [
    ...attrs,
    ...colors.map((c) => ({ key: "Rang", value: c })),
  ];

  const handleSaveCatalog = () => {
    if (!editCatalog || !editCatalogName.trim()) return;
    updateCatalog.mutate({
      id: editCatalog.id,
      data: { name: editCatalogName.trim(), imageUrl: editCatalogImage },
    });
  };

  const handleSaveProduct = () => {
    if (!editProduct || !editProductName.trim() || !editProductPrice) return;
    updateProduct.mutate({
      id: editProduct.id,
      data: {
        name: editProductName.trim(),
        price: parseFloat(editProductPrice),
        productId: editProductCustomId || undefined,
        imageUrl: editProductImage,
        attributes: buildProductAttrs(editProductAttrs, editProductColors),
      },
    });
  };

  const getSizeClasses = () => {
    switch (viewSize) {
      case "small":
        return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2";
      case "medium":
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3";
      case "large":
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";
    }
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const isLoading = catalogsLoading || (currentParentId !== null && productsLoading);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm font-medium text-muted-foreground overflow-x-auto whitespace-nowrap gap-1">
          <button
            onClick={() => handleNavigate(null)}
            className={`hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary ${!currentParentId ? "text-foreground font-semibold" : ""}`}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            Root
          </button>
          {breadcrumbs?.map((bc, idx) => (
            <div key={bc.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <button
                onClick={() => handleNavigate(bc.id)}
                className={`hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary truncate max-w-[120px] ${idx === (breadcrumbs.length - 1) ? "text-foreground font-semibold" : ""}`}
              >
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <ToggleGroup
            type="single"
            value={viewSize}
            onValueChange={(v: ViewSize) => v && setViewSize(v)}
            className="bg-secondary rounded-lg p-1"
          >
            <ToggleGroupItem value="small" className="h-8 w-8 px-0">
              <ListIcon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="medium" className="h-8 w-8 px-0">
              <Grid3X3 className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="large" className="h-8 w-8 px-0">
              <LayoutGrid className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-lg gap-1.5">
                  <Plus className="h-4 w-4" /> Qo'shish
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCreateCatalogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" /> Yangi katalog
                </DropdownMenuItem>
                {currentParentId && (
                  <DropdownMenuItem onClick={() => setCreateProductOpen(true)}>
                    <PackagePlus className="h-4 w-4 mr-2" /> Yangi mahsulot
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">
            {selectedProductIds.length} ta tanlandi
          </span>
          <div className="w-px h-5 bg-border" />
          <Button
            variant="destructive"
            size="sm"
            className="rounded-full"
            onClick={() => {
              if (
                confirm(
                  `${selectedProductIds.length} ta mahsulotni o'chirasizmi?`
                )
              ) {
                bulkDeleteProducts.mutate({ data: { ids: selectedProductIds } });
              }
            }}
            disabled={bulkDeleteProducts.isPending}
          >
            <Trash className="h-4 w-4 mr-1.5" /> O'chirish
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setSelectedProductIds([])}
          >
            <X className="h-4 w-4 mr-1.5" /> Bekor
          </Button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className={`grid ${getSizeClasses()}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-secondary/50 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className={`grid ${getSizeClasses()}`}>
          {/* Catalogs */}
          {hasCatalogs &&
            catalogs!.map((catalog) => (
              <Card
                key={catalog.id}
                data-testid={`card-catalog-${catalog.id}`}
                className="group overflow-hidden cursor-pointer hover:border-primary/60 transition-all hover:shadow-md"
                onClick={() => handleNavigate(catalog.id)}
              >
                <div className="relative aspect-square bg-secondary/40 flex items-center justify-center overflow-hidden">
                  {catalog.imageUrl ? (
                    <img
                      src={catalog.imageUrl}
                      alt={catalog.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FolderOpen
                      className={`text-primary/50 ${viewSize === "small" ? "h-8 w-8" : viewSize === "medium" ? "h-10 w-10" : "h-14 w-14"}`}
                    />
                  )}
                  {isAdmin && (
                    <div
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 shadow-md"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={(e) => openEditCatalog(catalog, e)}
                          >
                            <Edit className="h-4 w-4 mr-2" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `"${catalog.name}" katalogini o'chirasizmi?`
                                )
                              ) {
                                deleteCatalog.mutate({ id: catalog.id });
                              }
                            }}
                          >
                            <Trash className="h-4 w-4 mr-2" /> O'chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                <CardContent className="p-2">
                  <p
                    className="font-medium truncate text-sm"
                    title={catalog.name}
                  >
                    {catalog.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {catalog.childCount > 0
                      ? `${catalog.childCount} katalog`
                      : `${catalog.productCount} mahsulot`}
                  </p>
                </CardContent>
              </Card>
            ))}

          {/* Products */}
          {hasProducts &&
            products!.map((product) => {
              const colors = (product.attributes as Attr[])
                .filter((a) => a.key === "Rang")
                .map((a) => a.value);

              return (
                <Card
                  key={product.id}
                  data-testid={`card-product-${product.id}`}
                  className={`group overflow-hidden cursor-pointer hover:border-primary/60 transition-all ${selectedProductIds.includes(product.id) ? "border-primary ring-1 ring-primary" : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-stop]")) return;
                    setViewProduct(product);
                  }}
                >
                  <div className="relative aspect-square bg-secondary/40 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package
                        className={`text-muted-foreground/40 ${viewSize === "small" ? "h-8 w-8" : viewSize === "medium" ? "h-10 w-10" : "h-14 w-14"}`}
                      />
                    )}
                    {isAdmin && (
                      <div
                        data-stop
                        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Checkbox
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={() =>
                            toggleProductSelection(product.id)
                          }
                          className="bg-background/80 border-white/50 data-[state=checked]:bg-primary"
                        />
                      </div>
                    )}
                    {isAdmin && (
                      <div
                        data-stop
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-7 w-7 shadow-md"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditProduct(product)}
                            >
                              <Edit className="h-4 w-4 mr-2" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10"
                              onClick={() => {
                                if (
                                  confirm(
                                    `"${product.name}" mahsulotini o'chirasizmi?`
                                  )
                                ) {
                                  deleteProduct.mutate({ id: product.id });
                                }
                              }}
                            >
                              <Trash className="h-4 w-4 mr-2" /> O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    {/* Color dots preview */}
                    {colors.length > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                        {colors.slice(0, 4).map((c) => (
                          <Badge
                            key={c}
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 bg-black/50 text-white border-0"
                          >
                            {c}
                          </Badge>
                        ))}
                        {colors.length > 4 && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 bg-black/50 text-white border-0"
                          >
                            +{colors.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p
                      className="font-medium truncate text-sm"
                      title={product.name}
                    >
                      {product.name}
                    </p>
                    <p className="text-xs text-primary font-semibold">
                      {Number(product.price).toLocaleString()} so'm
                    </p>
                  </CardContent>
                </Card>
              );
            })}

          {/* Empty */}
          {!hasCatalogs && !hasProducts && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Bo'sh</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Bu yerda hali hech narsa yo'q
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-3 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateCatalogOpen(true)}
                  >
                    <FolderPlus className="h-4 w-4 mr-1.5" /> Katalog qo'shish
                  </Button>
                  {currentParentId && (
                    <Button
                      size="sm"
                      onClick={() => setCreateProductOpen(true)}
                    >
                      <PackagePlus className="h-4 w-4 mr-1.5" /> Mahsulot
                      qo'shish
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PRODUCT DETAIL */}
      <ProductDetailDialog
        product={viewProduct}
        open={!!viewProduct}
        onClose={() => setViewProduct(null)}
        onEdit={() => viewProduct && openEditProduct(viewProduct)}
        isAdmin={isAdmin}
      />

      {/* CREATE CATALOG */}
      <Dialog
        open={createCatalogOpen}
        onOpenChange={(o) => {
          setCreateCatalogOpen(o);
          if (!o) {
            setNewCatalogName("");
            setNewCatalogImage(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi katalog</DialogTitle>
            <DialogDescription>Yangi papka yarating</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImageUpload
              value={newCatalogImage}
              onChange={setNewCatalogImage}
              label="Rasm (ixtiyoriy)"
            />
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                placeholder="Katalog nomi"
                autoFocus
                data-testid="input-catalog-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateCatalogOpen(false)}>
              Bekor
            </Button>
            <Button
              data-testid="button-create-catalog"
              disabled={!newCatalogName.trim() || createCatalog.isPending}
              onClick={() =>
                createCatalog.mutate({
                  data: {
                    name: newCatalogName.trim(),
                    imageUrl: newCatalogImage,
                    parentId: currentParentId,
                  },
                })
              }
            >
              {createCatalog.isPending ? "Yaratilmoqda..." : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE PRODUCT */}
      <Dialog
        open={createProductOpen}
        onOpenChange={(o) => {
          setCreateProductOpen(o);
          if (!o) {
            setNewProductName("");
            setNewProductPrice("");
            setNewProductId("");
            setNewProductImage(null);
            setNewProductAttrs([]);
            setNewProductColors([]);
          }
        }}
      >
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi mahsulot</DialogTitle>
            <DialogDescription>Mahsulot ma'lumotlarini kiriting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImageUpload
              value={newProductImage}
              onChange={setNewProductImage}
              label="Rasm (ixtiyoriy)"
            />
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Mahsulot nomi"
                data-testid="input-product-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Narxi (so'm)</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  placeholder="0"
                  data-testid="input-product-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mahsulot ID</Label>
                <Input
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value)}
                  placeholder="SKU-001"
                />
              </div>
            </div>

            {/* Ranglar */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label>Ranglar</Label>
              </div>
              <ColorInput
                colors={newProductColors}
                onChange={setNewProductColors}
              />
            </div>

            {/* Xususiyatlar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Label>Xususiyatlar</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setNewProductAttrs((prev) => [
                      ...prev,
                      { key: "", value: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Qo'shish
                </Button>
              </div>
              {newProductAttrs.map((attr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="h-8 text-sm"
                    placeholder="Nomi"
                    value={attr.key}
                    onChange={(e) =>
                      setNewProductAttrs((prev) =>
                        prev.map((a, j) =>
                          j === i ? { ...a, key: e.target.value } : a
                        )
                      )
                    }
                  />
                  <Input
                    className="h-8 text-sm"
                    placeholder="Qiymati"
                    value={attr.value}
                    onChange={(e) =>
                      setNewProductAttrs((prev) =>
                        prev.map((a, j) =>
                          j === i ? { ...a, value: e.target.value } : a
                        )
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      setNewProductAttrs((prev) =>
                        prev.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateProductOpen(false)}
            >
              Bekor
            </Button>
            <Button
              data-testid="button-create-product"
              disabled={
                !newProductName.trim() ||
                !newProductPrice ||
                !currentParentId ||
                createProduct.isPending
              }
              onClick={() =>
                createProduct.mutate({
                  data: {
                    name: newProductName.trim(),
                    price: parseFloat(newProductPrice),
                    catalogId: currentParentId!,
                    imageUrl: newProductImage,
                    productId: newProductId || undefined,
                    attributes: buildProductAttrs(
                      newProductAttrs,
                      newProductColors
                    ),
                  },
                })
              }
            >
              {createProduct.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT CATALOG */}
      <Dialog open={!!editCatalog} onOpenChange={(o) => !o && setEditCatalog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Katalogni tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImageUpload
              value={editCatalogImage}
              onChange={setEditCatalogImage}
              label="Rasm"
            />
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={editCatalogName}
                onChange={(e) => setEditCatalogName(e.target.value)}
                data-testid="input-edit-catalog-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCatalog(null)}>
              Bekor
            </Button>
            <Button
              data-testid="button-save-catalog"
              disabled={!editCatalogName.trim() || updateCatalog.isPending}
              onClick={handleSaveCatalog}
            >
              {updateCatalog.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT PRODUCT */}
      <Dialog open={!!editProduct} onOpenChange={(o) => !o && setEditProduct(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mahsulotni tahrirlash</DialogTitle>
            <DialogDescription>ID: {editProduct?.productId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImageUpload
              value={editProductImage}
              onChange={setEditProductImage}
              label="Rasm"
            />
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                data-testid="input-edit-product-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Narxi (so'm)</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={editProductPrice}
                  onChange={(e) => setEditProductPrice(e.target.value)}
                  data-testid="input-edit-product-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mahsulot ID</Label>
                <Input
                  value={editProductCustomId}
                  onChange={(e) => setEditProductCustomId(e.target.value)}
                />
              </div>
            </div>

            {/* Ranglar */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label>Ranglar</Label>
              </div>
              <ColorInput
                colors={editProductColors}
                onChange={setEditProductColors}
              />
            </div>

            {/* Xususiyatlar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Label>Xususiyatlar</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setEditProductAttrs((prev) => [
                      ...prev,
                      { key: "", value: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Qo'shish
                </Button>
              </div>
              {editProductAttrs.map((attr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="h-8 text-sm"
                    placeholder="Nomi"
                    value={attr.key}
                    onChange={(e) =>
                      setEditProductAttrs((prev) =>
                        prev.map((a, j) =>
                          j === i ? { ...a, key: e.target.value } : a
                        )
                      )
                    }
                  />
                  <Input
                    className="h-8 text-sm"
                    placeholder="Qiymati"
                    value={attr.value}
                    onChange={(e) =>
                      setEditProductAttrs((prev) =>
                        prev.map((a, j) =>
                          j === i ? { ...a, value: e.target.value } : a
                        )
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      setEditProductAttrs((prev) =>
                        prev.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditProduct(null)}>
              Bekor
            </Button>
            <Button
              data-testid="button-save-product"
              disabled={
                !editProductName.trim() ||
                !editProductPrice ||
                updateProduct.isPending
              }
              onClick={handleSaveProduct}
            >
              {updateProduct.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
