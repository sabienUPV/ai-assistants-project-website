// @ts-check
import { defineMarkdocConfig } from '@astrojs/markdoc/config';
import { getMarkdocTags } from '@sabien-upv-astro-cms/core';

export default defineMarkdocConfig({
  tags: getMarkdocTags('admin')
});