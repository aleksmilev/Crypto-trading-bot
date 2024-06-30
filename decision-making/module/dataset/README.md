---
license: apache-2.0
library_name: transformers
tags:
- finance
pipeline_tag: text-generation
base_model: TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T
---

# Tiny Crypto Sentiment Analysis

Fine-tuned (with LoRA) version of [TinyLlama](https://huggingface.co/TinyLlama/TinyLlama-1.1B-intermediate-step-1431k-3T) on cryptocurrency news articles
to predict the sentiment and subject of an article. The dataset used for training is [Crypto News+](https://www.kaggle.com/datasets/oliviervha/crypto-news/).

## How to Train Your Own Tiny LLM?

Follow the complete tutorial on how this model was trained: https://www.mlexpert.io/bootcamp/fine-tuning-tiny-llm-on-custom-dataset

## How to Use

Load the model:

```py
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

MODEL_NAME = "curiousily/tiny-crypto-sentiment-analysis"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    device_map="auto",
    torch_dtype=torch.float16
)

pipe = pipeline(
    task="text-generation",
    model=model,
    tokenizer=tokenizer,
    max_new_tokens=16,
    return_full_text=False,
)
```

Prompt format:

```py
prompt = """
### Title:
<YOUR ARTICLE TITLE>
### Text:
<YOUR ARTICLE PARAGRAPH>
### Prediction:
""".strip()
```

Here's an example:

```py
prompt = """
### Title:
Bitcoin Price Prediction as BTC Breaks Through $27,000 Barrier Here are Price Levels to Watch
### Text:
Bitcoin, the world's largest cryptocurrency by market capitalization, has been making headlines recently as it broke through the $27,000 barrier for the first time. This surge in price has reignited speculation about where Bitcoin is headed next, with many analysts and investors offering their predictions.
### Prediction:
""".strip()
```

Get a prediction:

```py
outputs = pipe(prompt)
print(outputs[0]["generated_text"].strip())
```

```md
subject: bitcoin
sentiment: positive
```
