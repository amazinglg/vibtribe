import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  SITE_NAME, LOGO_URL, SUPPORT_EMAIL,
  main, container, card, logo, eyebrow, h1, text, muted, legalBlock, footer,
} from './_shared'

interface Props { name?: string }

const OffboardingGeneral = ({ name }: Props) => {
  const first = (name || 'there').split(' ')[0]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} account has been discontinued.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo} />
            <Text style={eyebrow}>Account update</Text>
            <Heading style={h1}>Your {SITE_NAME} account has been discontinued</Heading>
            <Text style={text}>Hi {first},</Text>
            <Text style={text}>
              After careful review, we have decided to discontinue your {SITE_NAME}
              account in accordance with our platform policies and our commitment
              to maintaining a safe and secure community.
            </Text>
            <Text style={text}>
              We recognise this may be disappointing. This decision was not taken
              lightly and was made to protect the wider {SITE_NAME} community.
            </Text>
            <Text style={legalBlock as any}>
              <strong>About your data.</strong> Your personal data will be
              deleted or retained in accordance with applicable law (including
              the Digital Personal Data Protection Act, 2023), our Privacy Policy,
              and our legal obligations relating to security, fraud prevention,
              dispute resolution, and regulatory compliance.
            </Text>
            <Text style={muted}>
              If you believe this decision was made in error, you may contact us
              at <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#6366f1' }}>{SUPPORT_EMAIL}</a>.
            </Text>
            <Text style={footer}>— The {SITE_NAME} Trust &amp; Safety Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OffboardingGeneral,
  subject: `Your ${SITE_NAME} account has been discontinued`,
  displayName: 'Offboarding — General',
  previewData: { name: 'Sam' },
} satisfies TemplateEntry