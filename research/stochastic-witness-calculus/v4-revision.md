# Stochastic Witness Calculus v4 revision chapter

## Proof-status clarification

Stochastic Witness Calculus is an exact probabilistic proof calculus. When a sound verifier and an exact mass certificate establish strictly positive accepted mass, the resulting existence claim is an ordinary deterministic theorem. Probability supplies the proof object; it does not weaken truth to confidence.

The Erdős–Straus computation proves every instance in its declared finite domain: all 82,887 primes congruent to 1 modulo 24 below 10^7, using the declared shifts through 127, have exact reconstructed witnesses. This is a genuine finite-domain theorem. Universal closure is a separate quantifier and requires an exact argument covering every remaining integer.

## Theorem V4.1 — exact finite-domain closure

Let D be finite. For each i in D, let V_i be a sound deterministic verifier and let mu_i be a probability distribution on witnesses. If an exact checker certifies mu_i(A_i) > 0 for every i in D, then every instance in D has a valid witness.

Proof: Apply the exact existence rule independently to each i. Finiteness allows the checked certificates to be conjoined into one finite proof object.

## Theorem V4.2 — full-support universal lifting

Let I be a countable instance family and nu a probability distribution satisfying nu(i) > 0 for every i in I. For each i, let mu_i be a witness distribution, V_i a sound verifier, and A_i its accepted set. Define Z = {i in I : mu_i(A_i) = 0}. If an exact certificate proves nu(Z) = 0, then every i in I has a valid witness.

Proof: If Z were nonempty, choose i_0 in Z. Full support gives nu(i_0) > 0, hence nu(Z) >= nu(i_0) > 0, contradicting nu(Z) = 0. Thus Z is empty. Therefore mu_i(A_i) > 0 for every i, and the exact existence rule yields a valid witness for every instance.

This is a probability-based universal proof, not a confidence statement. The premise nu(Z) = 0 must itself be proved exactly. A finite sample with zero observed failures cannot replace it.

## Theorem V4.3 — mass-gap closure

Let Z be the failure set under an instance distribution nu. Suppose a structural theorem proves that Z nonempty implies nu(Z) >= eta for some eta > 0. If an exact certificate proves nu(Z) < eta, then Z is empty.

Proof: Otherwise the structural lower bound and certified upper bound contradict each other.

This theorem isolates a route by which arithmetic structure and exact distributional calculations can close a universal statement. The essential object is a proved mass gap, not an empirical confidence interval.

## Corollary V4.4 — analytic tail plus finite verification

If a theorem proves every instance above a bound B and exact verification proves every instance at or below B, then the universal statement follows.

## Erdős–Straus specialization

After standard reductions, it is sufficient to resolve the remaining prime class. SWC can close the conjecture through any of the following exact routes:

1. a pointwise positive-mass certificate for every remaining prime;
2. an exact full-support proof that the zero-mass instance set has measure zero;
3. a structural mass-gap theorem combined with an exact upper bound below that gap;
4. an analytic tail theorem combined with complete finite verification;
5. a symbolic family cover whose union contains every remaining prime.

The present finite computation supplies a fully proved finite component. It does not yet supply one of the universal premises above.

## Ground-truth statistics

Ground-truth statistics can participate in a proof when they are exact mathematical objects: complete counts over a certified finite domain, symbolic probability identities, formally bounded measures, verified recurrences, or exhaustive computations joined to a proved reduction. Estimated frequencies, posterior confidence, density-one results, and a 100 percent observed success rate remain empirical unless a theorem eliminates all exceptional instances.

## Version statement

Version 4 supersedes wording that could be read as denying proof status to the finite computation. “Not a proof of the universal conjecture” means only that its quantifier is finite. It does not mean that the checked finite theorem is approximate, statistical, or less than a real proof.
