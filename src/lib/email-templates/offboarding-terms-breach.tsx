import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  SITE_NAME, SITE_URL, LOGO_URL, SUPPORT_EMAIL,
  main, container, card, logo, eyebrow, h1, text, muted, button, legalBlock, footer,
} from './_shared'

interface Props { name?: string; appealUrl?: string }

const OffboardingTerms = ({ name, appealUrl }: Props) => {
  const first = (name || 'there').split(' ')[0]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} account has been removed for violating our Terms &amp; Conditions.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo} />
            <Text style={{ ...eyebrow, color: '#dc2626' }}>Policy enforcement</Text>
            <Heading style={h1}>Your {SITE_NAME} account has been removed</Heading>
            <Text style={text}>Hi {first},</Text>
            <Text style={text}>
              We are writing to let you know that your {SITE_NAME} account has
              been permanently removed following a review that identified
              activity in breach of our{' '}
              <a href={`${SITE_URL}/terms`} style={{ color: '#6366f1' }}>Terms &amp; Conditions</a>.
            </Text>
            <Text style={text}>
              These rules exist to keep {SITE_NAME} a safe, respectful place for
              everyone. Because of the nature of the violation, your access to
              the platform has been terminated with immediate effect.
              Your email address and mobile number have also been blocked from
              creating a new account.
            </Text>
            {appealUrl ? (
              <>
                <Text style={text}>
                  If you believe this decision was made in error, you may appeal
                  it here — a moderator will review and respond by email.
                </Text>
                <Button style={button} href={appealUrl}>
                  Appeal this decision
                </Button>
              </>
            ) : null}
            <Text style={legalBlock as any}>
              <strong>About your data.</strong> Your personal data will be
              deleted or retained in accordance with applicable law (including
              the Digital Personal Data Protection Act, 2023), our{' '}
              <a href={`${SITE_URL}/privacy`} style={{ color: '#6366f1' }}>Privacy Policy</a>,
              and our legal obligations relating to security, fraud prevention,
              dispute resolution, and regulatory compliance.
            </Text>
            <Text style={muted}>
              You may also write to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#6366f1' }}>{SUPPORT_EMAIL}</a>{' '}
              within 30 days. Please do not attempt to create a new account
              until your appeal is reviewed.
            </Text>
            <Text style={footer}>— The {SITE_NAME} Trust &amp; Safety Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OffboardingTerms,
  subject: `Your ${SITE_NAME} account has been removed`,
  displayName: 'Offboarding — Terms breach',
  previewData: { name: 'Sam', appealUrl: 'https://www.vibtribe.in/appeal-offboarding/preview-token' },
} satisfies TemplateEntry