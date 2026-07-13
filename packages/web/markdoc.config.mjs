// @ts-check
import { defineMarkdocConfig } from '@astrojs/markdoc/config';
import { getMarkdocTags } from '@sabien-upv-astro-cms/core/src/markdoc-tags';

export default defineMarkdocConfig({
  tags: getMarkdocTags('web')
});