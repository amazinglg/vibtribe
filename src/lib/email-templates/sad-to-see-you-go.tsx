import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  SITE_NAME, SITE_URL, LOGO_URL, SUPPORT_EMAIL,
  main, container, card, logo, eyebrow, h1, text, muted, button, legalBlock, footer,
} from './_shared'

interface Props {
  name?: string
  reasonLabel?: string
  reasonText?: string
}

const SadToSeeYouGo = ({ name, reasonLabel, reasonText }: Props) => {
  const first = (name || 'there').split(' ')[0]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Sad to see you go — your {SITE_NAME} account has been deleted.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo} />
            <Text style={eyebrow}>Account closed</Text>
            <Heading style={h1}>Sad to see you go, {first} 👋</Heading>
            <Text style={text}>
              We have received and processed your request to delete your{' '}
              {SITE_NAME} account. All of your profile information, chats,
              statuses, contacts and sign-in credentials have been permanently
              removed from our systems.
            </Text>
            {reasonLabel ? (
              <Text style={muted}>
                <strong>Reason you selected:</strong> {reasonLabel}
                {reasonText ? (
                  <>
                    <br />
                    <em>“{reasonText}”</em>
                  </>
                ) : null}
              </Text>
            ) : null}
            <Text style={text}>
              Thank you for the time you spent with us. If you ever change your
              mind, you’re welcome to create a fresh account whenever you like.
            </Text>
            <Button style={button} href={`${SITE_URL}/sign-up`}>
              Rejoin {SITE_NAME}
            </Button>
            <Text style={muted}>
              We’d also love to hear what we could have done better — a quick
              reply to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#6366f1' }}>{SUPPORT_EMAIL}</a>{' '}
              genuinely helps us improve.
            </Text>
            <Text style={legalBlock as any}>
              <strong>About your data.</strong> Your personal data has been
              deleted or retained in accordance with applicable law (including
              the Digital Personal Data Protection Act, 2023), our{' '}
              <a href={`${SITE_URL}/privacy`} style={{ color: '#6366f1' }}>Privacy Policy</a>,
              and our legal obligations relating to security, fraud prevention,
              dispute resolution, and regulatory compliance.
            </Text>
            <Text style={footer}>— The {SITE_NAME} Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SadToSeeYouGo,
  subject: `Sad to see you go — your ${SITE_NAME} account has been deleted`,
  displayName: 'Sad to see you go (self-delete)',
  previewData: {
    name: 'Sam',
    reasonLabel: 'I found a better alternative',
    reasonText: 'Wanted something with a bigger friend group already on it.',
  },
} satisfies TemplateEntry