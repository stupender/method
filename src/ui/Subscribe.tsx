// ============================================================================
// ui/Subscribe.tsx — the one place this app asks for anything
// ----------------------------------------------------------------------------
// Posts an email address to Stu's Kit (formerly ConvertKit) list. It's the same
// list and the same FORM as the Being Sound site — deliberately, rather than a
// new one. Kit has a custom field called `source` on that form, so `footer`,
// `listen`, `loop` and now `fretboard` all land in one list, tagged by where
// the person came from. Two forms would mean two lists to reconcile later.
//
// NO API KEY, and none is missing. Kit's form-subscription endpoint is public
// by design, which is exactly why it's safe to call from a page that ships its
// own source. Don't go looking for a secret to add.
//
// WHERE IT'S ASKED MATTERS AS MUCH AS WHAT'S ASKED. There's no signup wall in
// front of this app and there shouldn't be: the first ten seconds — a fretboard
// lighting up — is the whole pitch, and a form spends that moment on paperwork.
// So it appears in two places, both after someone has already decided they care:
//
//   invitation — once, when you save your FIRST setting, because at that exact
//                moment the offer is TRUE. Saved settings really do live in
//                this one browser and nowhere else, so "want these to follow
//                you?" is a fact about the app rather than a sales line.
//   footer     — quiet and permanent, for everyone who never saves anything.
//
// Asked once, then never again: saving or dismissing is remembered.
// ============================================================================

import { useState } from 'react';
import { markSubscribed } from './asked';
import './Subscribe.css';

const ENDPOINT = 'https://app.kit.com/forms/9739307/subscriptions';
/** Which door this person came through, as Kit's `source` custom field. */
const SOURCE = 'fretboard';

/**
 * Deliberately loose. The only thing worth catching here is a typo bad enough
 * that Kit would reject it anyway — "something@something.something". Anything
 * cleverer starts rejecting real addresses, and the cost of a wrong guess is
 * that someone who wanted to hear from Stu is told they don't exist.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type Status = 'idle' | 'sending' | 'done' | 'error';

export function Subscribe({
  variant,
  onClose,
}: {
  /** How it's dressed: the once-only card, or the line in the footer. */
  variant: 'invitation' | 'footer';
  /** Only the invitation can be closed. */
  onClose?: () => void;
}) {
  const [email, setEmail] = useState('');
  // The honeypot: a field no person can see, so anything in it came from a bot
  // filling every input on the page. Kept in state rather than read off the DOM
  // so this component still has no DOM reads at all.
  const [trap, setTrap] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending' || status === 'done') return;

    // A bot filled the hidden field. Say thank you and send nothing — telling
    // it that it was caught only teaches it to avoid the trap next time.
    if (trap !== '') {
      setStatus('done');
      return;
    }

    if (!looksLikeEmail(email)) {
      setStatus('error');
      return;
    }

    setStatus('sending');
    const body = new URLSearchParams();
    body.set('email_address', email.trim());
    body.set('fields[source]', SOURCE);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // NOT OPTIONAL. Without it Kit answers a browser with an HTML page,
          // parsing it as JSON throws, and the form reports failure to someone
          // whose signup actually WORKED — the worst kind of bug, because it
          // succeeds and says it didn't. Learned the expensive way on the
          // Being Sound site; carried over here rather than rediscovered.
          Accept: 'application/json',
        },
        body: body.toString(),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus('done');
      markSubscribed();
    } catch {
      setStatus('error');
    }
  };

  // Once they're in, the form has nothing left to do. The invitation says so
  // and stays put until dismissed; the footer just goes quiet.
  if (status === 'done') {
    return (
      <div className={`subscribe subscribe--${variant} subscribe--done`}>
        <p className="subscribe__thanks">
          {variant === 'invitation'
            ? "You're on the list — thank you. Nothing changes here; you'll just hear when something does."
            : "You're on the list — thank you."}
        </p>
        {onClose && (
          <button className="subscribe__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`subscribe subscribe--${variant}`}>
      {variant === 'invitation' && (
        <>
          <h2 className="subscribe__title">Saved — in this browser</h2>
          <p className="subscribe__blurb">
            Settings you save live in this browser and nowhere else, so they
            won't follow you to another device. Leave an email and you'll hear
            when they can — and when anything else worth playing with lands.
          </p>
        </>
      )}
      {variant === 'footer' && (
        <p className="subscribe__blurb">
          Fretboard Constellations is in beta and still being built. Leave an
          email to hear what's next.
        </p>
      )}

      {/* `noValidate` turns OFF the browser's own checking, which otherwise
          blocks the submit event before any of this runs — so the message
          below never appeared and the browser showed its own bubble instead,
          in its own words. One validator, one voice. `type="email"` stays for
          the keyboard it gives a phone. */}
      <form className="subscribe__form" onSubmit={submit} noValidate>
        <label className="subscribe__label" htmlFor={`sub-${variant}`}>
          Email
        </label>
        <input
          id={`sub-${variant}`}
          className="subscribe__input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle'); // typing is trying again
          }}
        />
        {/* The trap. Hidden from sight AND from screen readers, and marked
            not-to-autofill so a password manager doesn't fill it and lock a
            real person out. */}
        <input
          className="subscribe__trap"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
        <button className="pill pill--on" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Join'}
        </button>
      </form>

      {status === 'error' && (
        <p className="subscribe__error" role="status">
          {looksLikeEmail(email)
            ? "That didn't send — worth trying again in a moment."
            : 'That address looks incomplete.'}
        </p>
      )}

      {onClose && (
        <button className="subscribe__close" onClick={onClose} aria-label="Not now">
          ×
        </button>
      )}
    </div>
  );
}
