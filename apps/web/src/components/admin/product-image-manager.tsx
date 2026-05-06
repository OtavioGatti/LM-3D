"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ProductImage = {
  id: string;
  public_url: string | null;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

type ProductImageManagerProps = {
  productId: string;
  productName: string;
  images: ProductImage[];
  onChanged: () => Promise<void>;
};

const bucketName = "product-images";

function imageSrc(image: ProductImage) {
  return image.public_url ?? "";
}

export function ProductImageManager({
  productId,
  productName,
  images,
  onChanged
}: ProductImageManagerProps) {
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function uploadImage(file: File) {
    setMessage("");
    setIsUploading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, file, {
        cacheControl: "31536000",
        upsert: false
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
      const nextSortOrder =
        images.reduce((max, image) => Math.max(max, image.sort_order ?? 0), 0) + 1;
      const { error: insertError } = await supabase.from("product_images").insert({
        product_id: productId,
        storage_path: path,
        public_url: publicUrlData.publicUrl,
        alt: productName,
        sort_order: nextSortOrder,
        is_primary: images.length === 0
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setMessage("Imagem enviada.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setIsUploading(false);
    }
  }

  async function removeImage(image: ProductImage) {
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("product_images").delete().eq("id", image.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (image.storage_path) {
        await supabase.storage.from(bucketName).remove([image.storage_path]);
      }

      setMessage("Imagem removida.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover a imagem.");
    }
  }

  return (
    <section className="product-image-admin">
      <div>
        <h3>Imagens do produto</h3>
        <p>Envie fotos ou artes do produto. A primeira imagem aparece como destaque na vitrine.</p>
      </div>

      <label className="image-upload-dropzone">
        <ImagePlus aria-hidden="true" size={20} />
        {isUploading ? "Enviando..." : "Enviar imagem"}
        <input
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void uploadImage(file);
            }

            event.target.value = "";
          }}
          type="file"
        />
      </label>

      {message ? <p className="form-note">{message}</p> : null}

      {images.length > 0 ? (
        <div className="product-image-grid">
          {images.map((image) => (
            <article key={image.id}>
              {imageSrc(image) ? <img src={imageSrc(image)} alt={image.alt ?? productName} /> : null}
              <div>
                <span>{image.is_primary ? "Principal" : `Ordem ${image.sort_order}`}</span>
                <button type="button" onClick={() => void removeImage(image)}>
                  <Trash2 aria-hidden="true" size={15} />
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Nenhuma imagem enviada</h2>
          <p>Enquanto nao houver upload, a vitrine usa uma imagem padrao.</p>
        </div>
      )}
    </section>
  );
}
