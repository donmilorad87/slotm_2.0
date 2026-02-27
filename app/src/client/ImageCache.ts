// @ts-nocheck
/**
 * ImageCache - Utility class for caching images to localStorage
 * Provides faster loading for frequently used images like joker, symbols, etc.
 */
export default class ImageCache {
  static CACHE_PREFIX = 'slot_img_cache_';
  static MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage images

  /**
   * Get an image from cache or store it if not cached
   * @param {string} key - Unique identifier for the image
   * @param {string} base64Data - Base64 encoded image data (with or without data URI prefix)
   * @returns {string} - The base64 image data
   */
  static getImage(key, base64Data) {
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
    } catch (e) {
      console.warn('[ImageCache] localStorage error:', e);
      return base64Data;
    }
  }

  /**
   * Store an image in cache
   * @param {string} key - Unique identifier for the image
   * @param {string} base64Data - Base64 encoded image data
   */
  static setImage(key, base64Data) {
    const cacheKey = this.CACHE_PREFIX + key;

    try {
      // Check if we're within size limits
      if (base64Data && base64Data.length < this.MAX_CACHE_SIZE) {
        localStorage.setItem(cacheKey, base64Data);
      }
    } catch (e) {
      // localStorage might be full, try to clear old cache entries
      console.warn('[ImageCache] Failed to cache image:', e);
      this.clearOldEntries();
    }
  }

  /**
   * Check if an image is cached
   * @param {string} key - Unique identifier for the image
   * @returns {boolean}
   */
  static isCached(key) {
    const cacheKey = this.CACHE_PREFIX + key;
    try {
      return localStorage.getItem(cacheKey) !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Remove an image from cache
   * @param {string} key - Unique identifier for the image
   */
  static removeImage(key) {
    const cacheKey = this.CACHE_PREFIX + key;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.warn('[ImageCache] Failed to remove image:', e);
    }
  }

  /**
   * Clear all cached images
   */
  static clearAll() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('[ImageCache] Failed to clear cache:', e);
    }
  }

  /**
   * Clear oldest cache entries when storage is full
   */
  static clearOldEntries() {
    try {
      // Remove all slot machine image cache entries
      this.clearAll();
    } catch (e) {
      console.warn('[ImageCache] Failed to clear old entries:', e);
    }
  }

  /**
   * Preload an image and call callback when ready
   * @param {string} src - Image source (URL or base64)
   * @param {Function} callback - Called with loaded Image element
   * @returns {HTMLImageElement}
   */
  static preloadToImage(src, callback) {
    const img = new Image();

    img.onload = () => {
      if (callback) callback(img);
    };

    img.onerror = () => {
      console.warn('[ImageCache] Failed to load image:', src.substring(0, 50) + '...');
      if (callback) callback(null);
    };

    img.src = src;
    return img;
  }

  /**
   * Load image from cache or URL, returning a Promise
   * @param {string} key - Cache key
   * @param {string} src - Image source if not cached
   * @returns {Promise<HTMLImageElement>}
   */
  static loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const cachedSrc = this.getImage(key, src);

      this.preloadToImage(cachedSrc, (img) => {
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
   * @returns {number}
   */
  static getCacheSize() {
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
    } catch (e) {
      console.warn('[ImageCache] Failed to calculate cache size:', e);
    }
    return totalSize;
  }
}
