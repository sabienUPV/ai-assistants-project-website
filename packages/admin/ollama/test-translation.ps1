$prompt = @"
You are a professional English (en) to Spanish (es) translator. Your goal is to accurately convey the meaning and nuances of the original English text while adhering to Spanish grammar, vocabulary, and cultural sensitivities.
Produce only the Spanish translation, without any additional explanations or commentary. Please translate the following English text into Spanish:


# Welcome to the Module

In this section, we will explore the basic concepts of how an LLM processes human language.

{% callout type="warning" %}
Please make sure you have completed the prerequisites before starting this lesson.
{% /callout %}

Let's begin!
"@

.\generate.ps1 -Model "translategemma:4b" -Prompt $prompt