///////////////// logg \\\\\\\\\\\\\\\\\\\\\\\\\\\
class Logg {
  constructor(maxSize = 500, active = true) {
    this.maxSize = maxSize;
    this.elements = new Array(maxSize);
    this.full = false;
    this.start = this.end = 0;
    this._active = active;
  }

  get active() {
    return this._active;
  }

  set active(a) {
    this._active = a;
  }

  get length() {
    let size = 0;
    if (this.end < this.start) {
      size = this.maxSize - this.start + this.end;
    } else if (this.end === this.start) {
      size = (this.full ? this.maxSize : 0);
    } else {
      size = this.end - this.start;
    }
    return size;
  }

  get size() {
    return this.maxSize;
  }

  set size(m) {
    this.maxSize = m;
    this.clear();
  }

  clear() {
    this.full = false;
    this.end = this.start = 0;
    this.elements = new Array(this.maxSize);
  }

  add(o) {
    if (this._active) {
      this.length === this.maxSize && this.remove();
      this.elements[this.end++] = o;
      this.end >= this.maxSize && (this.end = 0);
      this.end === this.start && (this.full = true);
    }
  }

  item(idx) {
    return this.length == 0 ? null : this.elements[idx];
  }

  /**
   * Removes the first item from the array; like pop but doesn't return the popped value.
   */
  remove() {
    if (this.length === 0) { return; }
    let element = this.elements[this.start];
    if (element) {
      this.elements[this.start++] = null; // Delete instead?
      this.start >= this.maxSize && (this.start = 0);
      this.full = false;
    }
  }

  /** |delete| is a JS keyword so we use |del|
   * |indices| should be an array of 0-indexed indices to remove
   */
  del(indices) {
    for (let i=0, len = indices.length; i < len; i++) {
      let idx = indices[i];
      // Is index out-of-bounds?
      if (idx < 0 || idx >= this.length) { continue; }
      this.elements.splice(idx, 1);
      this.end--;
      this.full = false
    }
  }
}
