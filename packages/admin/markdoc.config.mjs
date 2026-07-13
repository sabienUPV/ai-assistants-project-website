// @ts-check
import { defineMarkdocConfig } from '@astrojs/markdoc/config';
import { getMarkdocTags } from '@markdoc-tags';

export default defineMarkdocConfig({
  tags: getMarkdocTags('admin')
});