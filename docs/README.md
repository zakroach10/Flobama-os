# FloBama OS documentation

## Product overview PDF

- **[flobama-os-v1.pdf](./flobama-os-v1.pdf)** — FloBama OS V1 product overview (features, APIs, architecture & database diagrams, runtime flows)
- `flobama-os-v1.html` — HTML companion used during earlier layout experiments

### Regenerate the PDF

```bash
pip install reportlab
python3 scripts/generate-flobama-os-v1-pdf.py
```

Output: `docs/flobama-os-v1.pdf`
