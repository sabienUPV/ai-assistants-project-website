$systemPrompt = @"
You are an expert technical translator. Translate the provided Markdoc document from English to Spanish. 
STRICT RULES:
1. Do NOT translate YAML keys (e.g., 'title', 'description'). Only translate their values.
2. Do NOT translate or modify any Markdoc tags or their attributes (e.g., {% callout type="warning" %}).
3. Return ONLY the final translated Markdoc document, including both YAML and Markdoc content. Do not include introductory text.

EXAMPLE INPUT:
---
title: The Course
---
# Welcome
{% custom_tag /%}

EXAMPLE OUTPUT:
---
title: El Curso
---
# Bienvenido
{% custom_tag /%}
"@

$mdocContent = @"
---
title: Introduction to Large Language Models
description: A beginner-friendly module covering the fundamentals of AI and text generation.
---
# Welcome to the Module

In this section, we will explore the basic concepts of how an LLM processes human language.

{% callout type="warning" %}
Please make sure you have completed the prerequisites before starting this lesson.
{% /callout %}

Let's begin!
"@

.\generate.ps1 -System $systemPrompt -Prompt $mdocContent