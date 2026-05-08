"use client";

import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
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

function orderedImages(images: ProductImage[]) {
  return [...images].sort((first, second) => first.sort_order - second.sort_order);
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
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
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

      const remainingImages = orderedImages(images).filter((item) => item.id !== image.id);
      if (image.is_primary && remainingImages[0]) {
        await supabase
          .from("product_images")
          .update({ is_primary: true, sort_order: 1 })
          .eq("id", remainingImages[0].id);
      }

      setMessage("Imagem removida.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover a imagem.");
    }
  }

  async function updateAlt(image: ProductImage, alt: string) {
    setMessage("");

    try {
      const { error } = await getSupabaseBrowserClient()
        .from("product_images")
        .update({ alt: alt.trim() || productName })
        .eq("id", image.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage("Texto alternativo salvo.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o texto.");
    }
  }

  async function setPrimaryImage(image: ProductImage) {
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resetError } = await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);

      if (resetError) {
        throw new Error(resetError.message);
      }

      const { error: updateError } = await supabase
        .from("product_images")
        .update({ is_primary: true, sort_order: 1 })
        .eq("id", image.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const remainingImages = orderedImages(images).filter((item) => item.id !== image.id);
      await Promise.all(
        remainingImages.map((item, index) =>
          supabase
            .from("product_images")
            .update({ sort_order: index + 2 })
            .eq("id", item.id)
        )
      );

      setMessage("Imagem principal atualizada.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível definir a principal.");
    }
  }

  async function moveImage(image: ProductImage, direction: -1 | 1) {
    setMessage("");

    try {
      const sortedImages = orderedImages(images);
      const currentIndex = sortedImages.findIndex((item) => item.id === image.id);
      const targetIndex = currentIndex + direction;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedImages.length) {
        return;
      }

      const nextImages = [...sortedImages];
      const [movedImage] = nextImages.splice(currentIndex, 1);

      if (!movedImage) {
        return;
      }

      nextImages.splice(targetIndex, 0, movedImage);

      const supabase = getSupabaseBrowserClient();
      await Promise.all(
        nextImages.map((item, index) =>
          supabase
            .from("product_images")
            .update({ sort_order: index + 1 })
            .eq("id", item.id)
        )
      );

      setMessage("Ordem atualizada.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reordenar.");
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
          {orderedImages(images).map((image, index) => (
            <article key={image.id}>
              {imageSrc(image) ? <img src={imageSrc(image)} alt={image.alt ?? productName} /> : null}
              <div>
                <span>{image.is_primary ? "Principal" : `Ordem ${image.sort_order}`}</span>
                <label>
                  Texto alternativo
                  <input
                    defaultValue={image.alt ?? productName}
                    onBlur={(event) => void updateAlt(image, event.target.value)}
                  />
                </label>
                <div className="product-image-actions">
                  <button
                    disabled={index === 0}
                    type="button"
                    onClick={() => void moveImage(image, -1)}
                  >
                    <ArrowUp aria-hidden="true" size={15} />
                    Subir
                  </button>
                  <button
                    disabled={index === images.length - 1}
                    type="button"
                    onClick={() => void moveImage(image, 1)}
                  >
                    <ArrowDown aria-hidden="true" size={15} />
                    Descer
                  </button>
                </div>
                <button
                  disabled={image.is_primary}
                  type="button"
                  onClick={() => void setPrimaryImage(image)}
                >
                  <Star aria-hidden="true" size={15} />
                  Tornar principal
                </button>
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
          <p>Enquanto não houver upload, a vitrine usa uma imagem padrão.</p>
        </div>
      )}
    </section>
  );
}
