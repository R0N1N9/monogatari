// The "lite" build of exifr (JPEG, HEIC, TIFF) has the same API as the full one.
declare module "exifr/dist/lite.esm.mjs" {
  import exifr from "exifr";
  export default exifr;
}
