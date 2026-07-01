import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'VibTribe'
const LOGO_URL = 'https://www.vibtribe.in/icons/icon-192x192.png'

interface Props {
  code?: string
  minorName?: string
  guardianName?: string
}

const GuardianOtpEmail = ({ code = '000000', minorName = 'a young user', guardianName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} guardian verification code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="56" height="56" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          {guardianName ? `Hi ${guardianName},` : 'Hi there,'} {minorName} has listed you as their
          parent or guardian on {SITE_NAME}. Please use the code below to verify your email address —
          we'll then send you a consent request.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={text}>
          This code expires in <strong>15 minutes</strong>. If you don't recognise this request,
          you can ignore this email.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GuardianOtpEmail,
  subject: `Your ${SITE_NAME} guardian verification code`,
  displayName: 'Guardian OTP',
  previewData: { code: '482915', minorName: 'Aarav', guardianName: 'Priya' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '480px' }
const logo = { borderRadius: '12px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.55', margin: '0 0 20px' }
const codeBox = { backgroundColor: '#f4f4f7', border: '1px solid #e6e6ea', borderRadius: '12px', padding: '18px 12px', textAlign: 'center' as const, margin: '8px 0 24px' }
const codeText = { fontSize: '34px', fontWeight: 'bold' as const, letterSpacing: '10px', color: '#0a0a0f', margin: 0, fontFamily: 'monospace' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }