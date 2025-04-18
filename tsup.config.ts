import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  minify: true,
  outExtension() {
    return {
      js: `.js`,
    };
  },
});
