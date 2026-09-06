# SWC Erdős–Straus induction audit

Date: 2026-09-04  
Artifact: `stochastic_witness_calculus_artifact_v3.zip`  
SHA-256: `e22bc0f376244744e6b506b9562465ffc5174239f0fb9f0f7e8e1368f7121899`

## Intake integrity

- The archive contains the 34-page v3 PDF, `paper/main.tex`, bibliography, figures, Python reference kernel, C++ Erdős–Straus verifier, raw results, tests, and partial Lean sources.
- The archived PDF is byte-identical to the audited v3 PDF: `17ff47c284b79207e2365d286c18aaa19915c63bf0af655a587066a5647b462a`.
- The supplied `MANIFEST.sha256` has six stale entries: the final PDF and five regenerated result files do not match the older manifest values.
- Eleven core Python tests and five v3 invariant tests pass.
- The supplied v3 status record says the Lean files were not compiled because a Lean theorem-prover executable was unavailable. The local `lean` command is an unrelated CLI and cannot validate these files.

## Exact finite reproduction

The C++ verifier was compiled independently and rerun for `p < 10^7`, `p ≡ 1 (mod 24)`, and shifts `3,7,…,127`.

- Processed primes: 82,887
- Covered primes: 82,887
- Reconstructed witnesses verified: 82,887
- Maximum least successful shift: `c=107` at `p=8,803,369`
- The exact CSV columns `(p, least_c, first_d, branch, successful_shifts)` match the supplied result file byte-for-byte.
- Floating summaries differ only in the last binary-to-decimal digits across compiler/runtime environments and are not treated as proof fields.

An additional noncanonical stress test through `p < 5×10^7` processed 374,902 primes and found all covered by the same declared shifts, with the same maximum least shift. This is additional finite evidence, not a universal theorem.

## Induction audit

The v3 source already contains a correct generic “Well-founded reduction rule.” It requires:

1. exact certificates for base instances;
2. a well-founded rank or order;
3. for every nonbase instance, a strict reduction to lower-rank instances;
4. a checked transformer from lower-rank witnesses to a witness for the original instance.

For Erdős–Straus, divisor-to-multiple lifting is valid:

`4/d = 1/x + 1/y + 1/z` and `n=kd` imply

`4/n = 1/(kx) + 1/(ky) + 1/(kz)`.

This settles composites from certified prime factors. It does not settle a new prime.

The raw Erdős–Straus table contains only:

`p, least_c, first_d, branch, successful_shifts, uniform_mass, weighted_mass, uniform_expected_trials, weighted_expected_trials`.

It contains no lower-rank parent prime, descent rank, reduction proof, or witness transformer. The anchor-divisor certificate directly proves each tested prime; it does not derive that prime from a smaller Erdős–Straus instance.

## Current proof status

- Generic infinite-domain induction rule: proved on paper.
- Composite witness lifting: proved algebraically.
- Declared finite prime family: exactly verified.
- Prime-specific descent for every `p ≡ 1 (mod 24)`: not present in the artifact and not established by the finite data.
- Universal Erdős–Straus conjecture: not proved by this artifact.

The universal claim must remain blocked until an exact prime descent, complete symbolic cover, exact zero-failure-mass theorem, mass-gap contradiction, or analytic tail theorem is supplied and independently checked.
