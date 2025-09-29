// API endpoint for submitting AI readiness assessments
// Vercel serverless function

import { Pool } from 'pg';
import nodemailer from 'nodemailer';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Email transporter setup
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE;

  switch (emailService) {
    case 'sendgrid':
      return nodemailer.createTransporter({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });

    case 'gmail':
      return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

    default:
      return nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
  }
};

// Calculate readiness level based on total score
const getReadinessLevel = (score) => {
  if (score <= 40) return 'Foundation Level';
  if (score <= 65) return 'Developing Level';
  if (score <= 85) return 'Advanced Level';
  return 'AI-Ready Level';
};

// Calculate assessment score (simplified version)
const calculateScore = (formData) => {
  let score = 0;

  // AI Level scoring
  const aiLevelScores = {
    'none': 0,
    'basic': 20,
    'intermediate': 35,
    'advanced': 50
  };

  // Data Infrastructure scoring
  const dataInfraScores = {
    'poor': 0,
    'basic': 15,
    'good': 25,
    'excellent': 35
  };

  // Company size multiplier
  const companySizeMultipliers = {
    'startup': 1.0,
    'small': 1.1,
    'medium': 1.2,
    'enterprise': 1.3
  };

  score += aiLevelScores[formData.ai_level] || 0;
  score += dataInfraScores[formData.data_infrastructure] || 0;

  // Objectives bonus
  if (formData.objectives && Array.isArray(formData.objectives)) {
    score += formData.objectives.length * 5;
  }

  // Timeline factor
  const timelineBonus = {
    'immediate': 10,
    'short': 7,
    'medium': 5,
    'long': 2
  };
  score += timelineBonus[formData.timeline] || 0;

  // Apply company size multiplier
  const multiplier = companySizeMultipliers[formData.company_size] || 1.0;
  score = Math.round(score * multiplier);

  return Math.min(score, 100); // Cap at 100
};

// Generate email content based on readiness level
const getEmailContent = (readinessLevel, name, company, score) => {
  const templates = {
    'Foundation Level': {
      subject: `${name}, Your AI Foundation Assessment Results - Strategic Roadmap Included`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">AI Readiness Assessment Results</h2>
          <p>Hi ${name},</p>
          <p>Thank you for completing our AI Readiness Assessment. Your results show that ${company} is at the <strong>Foundation Level</strong> with a score of <strong>${score}/100</strong>.</p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Your Next Steps:</h3>
            <ul style="color: #4b5563;">
              <li>Develop a comprehensive AI strategy aligned with business goals</li>
              <li>Conduct a thorough data infrastructure audit</li>
              <li>Build organizational readiness through change management</li>
              <li>Establish budget and resource allocation for AI initiatives</li>
            </ul>
          </div>

          <p>We've prepared a detailed roadmap specifically for organizations at your stage. <strong>Would you like to schedule a complimentary 30-minute strategy session</strong> to discuss your AI transformation journey?</p>

          <a href="${process.env.APP_URL}/contact.html" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Schedule Strategy Session</a>

          <p>Best regards,<br>The InsightNext Team</p>
        </div>
      `
    },
    'Developing Level': {
      subject: `${name}, You're Progressing Well - Accelerate Your AI Journey`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">AI Readiness Assessment Results</h2>
          <p>Hi ${name},</p>
          <p>Excellent progress! ${company} is at the <strong>Developing Level</strong> with a score of <strong>${score}/100</strong>. You've built solid foundations and are ready to advance your AI capabilities.</p>

          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="color: #1e40af; margin-top: 0;">Recommended Focus Areas:</h3>
            <ul style="color: #1e3a8a;">
              <li>Address data infrastructure gaps for better integration</li>
              <li>Strengthen technical capabilities and ML skills</li>
              <li>Implement pilot AI projects for early wins</li>
              <li>Prepare comprehensive change management plans</li>
            </ul>
          </div>

          <p>You're well-positioned to accelerate your AI implementation. <strong>Let's discuss how to move to Advanced level</strong> with targeted improvements in your key opportunity areas.</p>

          <a href="${process.env.APP_URL}/contact.html" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Book Implementation Consultation</a>

          <p>Best regards,<br>The InsightNext Team</p>
        </div>
      `
    },
    'Advanced Level': {
      subject: `${name}, You're AI-Advanced - Let's Optimize for Maximum Impact`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">AI Readiness Assessment Results</h2>
          <p>Hi ${name},</p>
          <p>Impressive! ${company} has achieved <strong>Advanced Level</strong> readiness with a score of <strong>${score}/100</strong>. You're among the leaders in AI adoption and implementation.</p>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3 style="color: #15803d; margin-top: 0;">Optimization Opportunities:</h3>
            <ul style="color: #166534;">
              <li>Scale successful AI models across the organization</li>
              <li>Implement advanced ML operations and monitoring</li>
              <li>Explore cutting-edge AI technologies and applications</li>
              <li>Develop AI governance and ethics frameworks</li>
            </ul>
          </div>

          <p>At your level, the focus shifts to optimization and scaling. <strong>Let's explore advanced strategies</strong> to maximize ROI from your AI investments and maintain competitive advantage.</p>

          <a href="${process.env.APP_URL}/contact.html" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Discuss Advanced Strategies</a>

          <p>Best regards,<br>The InsightNext Team</p>
        </div>
      `
    },
    'AI-Ready Level': {
      subject: `${name}, Exceptional AI Readiness - Partnership Opportunities Await`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">AI Readiness Assessment Results</h2>
          <p>Hi ${name},</p>
          <p>Outstanding! ${company} has achieved <strong>AI-Ready Level</strong> with an exceptional score of <strong>${score}/100</strong>. You're at the forefront of AI innovation and implementation.</p>

          <div style="background: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eab308;">
            <h3 style="color: #a16207; margin-top: 0;">Strategic Partnership Areas:</h3>
            <ul style="color: #a16207;">
              <li>AI research and development initiatives</li>
              <li>Industry thought leadership and innovation</li>
              <li>Advanced AI product development</li>
              <li>AI consultancy and advisory services</li>
            </ul>
          </div>

          <p>Given your exceptional AI maturity, we'd love to explore <strong>strategic partnership opportunities</strong> and discuss how we can collaborate on cutting-edge AI initiatives.</p>

          <a href="${process.env.APP_URL}/contact.html" style="display: inline-block; background: #eab308; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Explore Partnership Opportunities</a>

          <p>Best regards,<br>The InsightNext Team</p>
        </div>
      `
    }
  };

  return templates[readinessLevel] || templates['Foundation Level'];
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'email', 'company', 'role', 'industry'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Calculate assessment score
    const totalScore = calculateScore(formData);
    const readinessLevel = getReadinessLevel(totalScore);

    // Insert into database
    const client = await pool.connect();
    try {
      const insertQuery = `
        INSERT INTO assessments (
          name, email, company, role, company_size, industry,
          ai_level, data_infrastructure, objectives, timeline, budget,
          total_score, readiness_level, session_id, user_agent, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `;

      const values = [
        formData.name,
        formData.email,
        formData.company,
        formData.role,
        formData.company_size,
        formData.industry,
        formData.ai_level,
        formData.data_infrastructure,
        JSON.stringify(formData.objectives || []),
        formData.timeline,
        formData.budget,
        totalScore,
        readinessLevel,
        req.headers['x-session-id'] || 'unknown',
        req.headers['user-agent'] || '',
        req.headers['x-forwarded-for'] || req.connection.remoteAddress
      ];

      const result = await client.query(insertQuery, values);
      const assessmentId = result.rows[0].id;

      // Send email
      try {
        const transporter = createTransporter();
        const emailContent = getEmailContent(readinessLevel, formData.name, formData.company, totalScore);

        await transporter.sendMail({
          from: `"InsightNext" <${process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER}>`,
          to: formData.email,
          subject: emailContent.subject,
          html: emailContent.html
        });

        // Update email_sent status
        await client.query('UPDATE assessments SET email_sent = true WHERE id = $1', [assessmentId]);

      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the entire request if email fails
      }

    } finally {
      client.release();
    }

    // Track analytics event
    console.log(`Assessment completed: ${formData.company} (${readinessLevel}, Score: ${totalScore})`);

    res.status(200).json({
      success: true,
      assessmentId: result.rows[0].id,
      totalScore,
      readinessLevel,
      message: 'Assessment submitted successfully. Check your email for detailed results.'
    });

  } catch (error) {
    console.error('Assessment submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit assessment. Please try again.'
    });
  }
}