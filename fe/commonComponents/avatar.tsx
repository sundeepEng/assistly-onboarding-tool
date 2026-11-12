import Image from "next/image";
import React from "react";
import { getInitials } from "../utils/getSignatureUtil";

type AvatarVariant = "default" | "bordered" | "solid";

type AvatarProps = {
  /** Profile image URL. When provided, the image is rendered instead of the initials fallback. */
  src?: string | null;
  /** Name used to derive the initials fallback when `src` is missing. */
  name?: string | null;
  /** Avatar diameter in pixels. Defaults to 40. */
  size?: number;
  /** Extra classes appended to the outer circular container. */
  className?: string;
  /** Extra classes appended to the rendered image. */
  imageClassName?: string;
  /** Alt text for the image. Defaults to "Profile". */
  alt?: string;
  /**
   * Visual style of the avatar:
   * - "default": tinted primary background (table cells)
   * - "bordered": tinted primary background with a bordered inner circle (large cards)
   * - "solid": dark solid background with white text (nav / header avatars)
   * Defaults to "default".
   */
  variant?: AvatarVariant;
};

const variantClasses: Record<AvatarVariant, string> = {
  default: "bg-primary bg-opacity-30",
  bordered: "bg-primary bg-opacity-30",
  solid: "bg-primary border-solid border-2 border-white",
};

/**
 * Common circular avatar that renders a profile image when available
 * and falls back to the person's initials on a tinted primary background.
 *
 * The diameter is controlled by the `size` prop (in px) so the same
 * component can be reused for small (table cells) and large (cards) avatars.
 */
const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 40,
  className = "",
  imageClassName = "",
  alt = "Profile",
  variant = "default",
}) => {
  // Padding scales with the avatar size (matches the existing p-[10px] on a 40px avatar).
  const padding = Math.max(2, Math.round(size / 4));
  // Initials font size scales with the avatar size.
  const fontSize = Math.max(12, Math.round(size / 2.5));

  const initialsColorClass = variant === "solid" ? "text-white" : "text-primary";

  return (
    <div
      className={`rounded-full flex items-center justify-center ${variantClasses[variant]} ${className}`}
      style={{
        height: size,
        width: size,
        padding: variant === "bordered" ? 0 : padding,
      }}
    >
      {src ? (
        <Image
          className={`relative object-cover cursor-pointer rounded-full ${imageClassName}`}
          loading="lazy"
          width={size}
          height={size}
          alt={alt}
          src={src}
          style={{ height: size, width: size }}
        />
      ) : variant === "bordered" ? (
        <div
          className="rounded-full border-2 border-primary flex items-center justify-center"
          style={{
            height: Math.round(size * 0.6),
            width: Math.round(size * 0.6),
          }}
        >
          <span
            className={`text-center text-primary font-semibold font-jakarta ${className}`}
            style={{ fontSize: Math.round(size / 2) }}
          >
            {getInitials(name)}
          </span>
        </div>
      ) : (
        <h3
          className={`text-center ${initialsColorClass} font-semibold m-0`}
          style={{ fontSize }}
        >
          {getInitials(name)}
        </h3>
      )}
    </div>
  );
};

export default Avatar;
