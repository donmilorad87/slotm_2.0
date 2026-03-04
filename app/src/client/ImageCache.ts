/**
 * ImageCache - Utility class for caching images to localStorage
 * Provides faster loading for frequently used images like joker, symbols, etc.
 */
export default class ImageCache {
  static CACHE_PREFIX = 'slot_img_cache_';
  static MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage images

  /**
   * Get an image from cache or store it if not cached
   */
  static getImage(key: string, base64Data: string): string {
    const cacheKey = this.CACHE_PREFIX + key;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return cached;
      }

      // Store in cache if we have data
      if (base64Data) {
        this.setImage(key, base64Data);
      }

      return base64Data;
    } catch (e: unknown) {
      console.warn('[ImageCache] localStorage error:', e);
      return base64Data;
    }
  }

  /**
   * Store an image in cache
   */
  static setImage(key: string, base64Data: string): void {
    const cacheKey = this.CACHE_PREFIX + key;

    try {
      // Check if we're within size limits
      if (base64Data && base64Data.length < this.MAX_CACHE_SIZE) {
        localStorage.setItem(cacheKey, base64Data);
      }
    } catch (e: unknown) {
      // localStorage might be full, try to clear old cache entries
      console.warn('[ImageCache] Failed to cache image:', e);
      this.clearOldEntries();
    }
  }

  /**
   * Check if an image is cached
   */
  static isCached(key: string): boolean {
    const cacheKey = this.CACHE_PREFIX + key;
    try {
      return localStorage.getItem(cacheKey) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Remove an image from cache
   */
  static removeImage(key: string): void {
    const cacheKey = this.CACHE_PREFIX + key;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e: unknown) {
      console.warn('[ImageCache] Failed to remove image:', e);
    }
  }

  /**
   * Clear all cached images
   */
  static clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key: string) => localStorage.removeItem(key));
    } catch (e: unknown) {
      console.warn('[ImageCache] Failed to clear cache:', e);
    }
  }

  /**
   * Clear oldest cache entries when storage is full
   */
  static clearOldEntries(): void {
    try {
      // Remove all slot machine image cache entries
      this.clearAll();
    } catch (e: unknown) {
      console.warn('[ImageCache] Failed to clear old entries:', e);
    }
  }

  /**
   * Preload an image and call callback when ready
   */
  static preloadToImage(
    src: string,
    callback: ((img: HTMLImageElement | null) => void) | null,
  ): HTMLImageElement {
    const img = new Image();

    img.onload = (): void => {
      if (callback) callback(img);
    };

    img.onerror = (): void => {
      console.warn('[ImageCache] Failed to load image:', src.substring(0, 50) + '...');
      if (callback) callback(null);
    };

    img.src = src;
    return img;
  }

  /**
   * Load image from cache or URL, returning a Promise
   */
  static loadImage(key: string, src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const cachedSrc = this.getImage(key, src);

      this.preloadToImage(cachedSrc, (img: HTMLImageElement | null) => {
        if (img) {
          resolve(img);
        } else {
          reject(new Error('Failed to load image'));
        }
      });
    });
  }

  /**
   * Get the size of all cached images in bytes
   */
  static getCacheSize(): number {
    let totalSize = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length * 2; // UTF-16 characters = 2 bytes each
          }
        }
      }
    } catch (e: unknown) {
      console.warn('[ImageCache] Failed to calculate cache size:', e);
    }
    return totalSize;
  }
}
