// @ts-check
import { component, defineMarkdocConfig } from '@astrojs/markdoc/config';

export default defineMarkdocConfig({
  tags: {
    flag: {
      render: component('./src/components/Markdoc/MarkdocFlag.astro'),
      attributes: {
        country: { type: String, required: true }  // The country code: 'eu', 'es'...
      }
    }
  }
});