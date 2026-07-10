import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateAdmin } from './admin';

const router = Router();

// GET settings
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const rosterSetting = await prisma.setting.findUnique({
      where: { key: 'enableRoster' }
    });
    
    return res.json({
      enableRoster: rosterSetting ? rosterSetting.value === 'true' : false
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST settings
router.post('/', authenticateAdmin, async (req, res) => {
  const { enableRoster } = req.body;
  if (enableRoster === undefined) {
    return res.status(400).json({ error: 'enableRoster is required' });
  }

  try {
    const val = enableRoster ? 'true' : 'false';
    await prisma.setting.upsert({
      where: { key: 'enableRoster' },
      update: { value: val },
      create: { key: 'enableRoster', value: val }
    });

    return res.json({ message: 'Settings saved successfully', enableRoster });
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
