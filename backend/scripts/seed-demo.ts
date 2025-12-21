/**
 * Demo Seed Script
 * 
 * Creates sample data for demonstrating the AI Advisor Agent.
 * Run with: npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample instructions for demo
const DEMO_INSTRUCTIONS = [
  'Always respond to emails from VIP clients (with @enterprise.com domain) within 2 hours',
  'When a client mentions "retirement" or "401k", flag the conversation as high priority',
  'After scheduling a meeting, always add a CRM note with the meeting purpose',
  'Summarize weekly email activity every Friday',
];

// Sample tasks for demo
const DEMO_TASKS = [
  {
    type: 'meeting_scheduling',
    status: 'waiting_reply',
    description: 'Schedule quarterly review with John Smith',
    data: {
      contactEmail: 'john.smith@client.com',
      contactName: 'John Smith',
      purpose: 'Q4 Portfolio Review',
      step: 'awaiting_response',
    },
  },
  {
    type: 'email_followup',
    status: 'pending',
    description: 'Follow up with Sarah about investment options',
    data: {
      contactEmail: 'sarah.jones@enterprise.com',
      contactName: 'Sarah Jones',
      lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
];

// Sample chat messages for context
const DEMO_MESSAGES = [
  {
    role: 'user',
    content: 'Hi! I need help managing my client communications.',
  },
  {
    role: 'assistant',
    content: `Hello! I'm your AI Advisor Assistant. I can help you with:

• **Email Management** - Send, read, and search through your Gmail
• **Calendar** - Find availability and schedule meetings
• **CRM** - Search contacts and add notes in HubSpot
• **Tasks** - Create and track follow-up tasks
• **Ongoing Instructions** - Set rules I'll follow automatically

What would you like to do first?`,
  },
  {
    role: 'user',
    content: 'Can you remind me to always follow up with enterprise clients within 24 hours?',
  },
  {
    role: 'assistant',
    content: `Done! I've saved this as an ongoing instruction:

📋 **"Always respond to emails from VIP clients (with @enterprise.com domain) within 2 hours"**

Now whenever I detect a new email from an @enterprise.com domain, I'll evaluate whether to take action based on this instruction. You can view and manage all your instructions from the dashboard.

Is there anything else you'd like me to remember?`,
  },
];

async function seedDemo() {
  console.log('🌱 Seeding demo data...\n');

  // Find or create a demo user
  let demoUser = await prisma.user.findFirst({
    where: { email: { contains: '@' } },
  });

  if (!demoUser) {
    console.log('ℹ️  No users found. Demo data will be seeded when a user logs in.');
    console.log('   Run this script again after logging in with Google OAuth.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`📧 Using user: ${demoUser.email}\n`);

  // Seed instructions
  console.log('📋 Creating demo instructions...');
  for (const content of DEMO_INSTRUCTIONS) {
    const existing = await prisma.instruction.findFirst({
      where: { userId: demoUser.id, content },
    });
    
    if (!existing) {
      await prisma.instruction.create({
        data: {
          userId: demoUser.id,
          content,
          active: true,
        },
      });
      console.log(`   ✅ ${content.substring(0, 50)}...`);
    } else {
      console.log(`   ⏭️  Already exists: ${content.substring(0, 30)}...`);
    }
  }

  // Seed tasks
  console.log('\n✅ Creating demo tasks...');
  for (const task of DEMO_TASKS) {
    const existing = await prisma.task.findFirst({
      where: { 
        userId: demoUser.id, 
        description: task.description,
      },
    });
    
    if (!existing) {
      await prisma.task.create({
        data: {
          userId: demoUser.id,
          ...task,
        },
      });
      console.log(`   ✅ ${task.description}`);
    } else {
      console.log(`   ⏭️  Already exists: ${task.description.substring(0, 30)}...`);
    }
  }

  // Seed chat messages (only if no messages exist)
  const messageCount = await prisma.message.count({
    where: { userId: demoUser.id },
  });

  if (messageCount === 0) {
    console.log('\n💬 Creating demo chat messages...');
    for (const msg of DEMO_MESSAGES) {
      await prisma.message.create({
        data: {
          userId: demoUser.id,
          role: msg.role,
          content: msg.content,
        },
      });
      console.log(`   ✅ ${msg.role}: ${msg.content.substring(0, 40)}...`);
    }
  } else {
    console.log(`\n💬 Chat already has ${messageCount} messages, skipping...`);
  }

  console.log('\n✨ Demo data seeded successfully!\n');
  console.log('Demo scenarios you can try:');
  console.log('  1. "Show my active instructions" - Lists ongoing rules');
  console.log('  2. "Search for clients named John" - Tests HubSpot search');
  console.log('  3. "What meetings do I have this week?" - Tests Calendar');
  console.log('  4. "Send an email to test@example.com" - Tests Gmail');
  console.log('  5. "Schedule a meeting with John Smith" - Tests full workflow');
  console.log('');

  await prisma.$disconnect();
}

seedDemo().catch((error) => {
  console.error('❌ Error seeding demo data:', error);
  prisma.$disconnect();
  process.exit(1);
});

