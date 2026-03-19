// ============================================
// Foundry Guardian - Design Governance Engine
// Main Orchestrator
//
// Detection strategy (3 layers):
//   1. Key match: component key or parent COMPONENT_SET key in JSON files
//   2. Name match: component name matches foundryName from JSON files
//   3. Extracted keys from clientStorage (via Extractor tab)
// ============================================

import html from './ui.html?raw';
import { FOUNDRY_SPACING_SCALE } from './types';
import type { ComponentIssue, TokenIssue, IconIssue, ScanResults, ScanSummary, AnalyticsSnapshot } from './types';

// Import keys directly from JSON source files (Vite resolves at build time)
import keysFoundry from '../keysFoundry.json';
import keysFoundryIcons from '../keysFoundryIcons.json';
import keysFoundryTokens from '../keysFoundryTokens.json';

// ============================
// Build lookup Sets from JSON sources
// ============================

const jsonKeys = new Set([
  ...keysFoundry.map((i: any) => i.foundryKey),
  ...keysFoundryIcons.map((i: any) => i.foundryKey),
  ...keysFoundryTokens.map((i: any) => i.foundryKey),
]);

function normalizeComponentName(name: string): string {
  return name.split('->')[0].split(' -> ')[0].trim().toLowerCase();
}

const jsonNames = new Set([
  ...keysFoundry.map((i: any) => normalizeComponentName(i.foundryName)),
  ...keysFoundryIcons.map((i: any) => normalizeComponentName(i.foundryName)),
  ...keysFoundryTokens.map((i: any) => normalizeComponentName(i.foundryName)),
]);

const jsonIconKeys = new Set(keysFoundryIcons.map((i: any) => i.foundryKey));
const jsonIconNames = new Set(keysFoundryIcons.map((i: any) => normalizeComponentName(i.foundryName)));

// ============================
// Extracted keys (loaded from clientStorage at scan time)
// ============================
let extractedKeys = new Set<string>();
let extractedNames = new Set<string>();

// Combined Sets (rebuilt after loading extracted keys)
let validKeys = new Set(jsonKeys);
let validNames = new Set(jsonNames);

const EXTRACTED_KEYS_STORAGE = 'guardian_extracted_keys';
const STORAGE_KEY = 'guardian_history';
const MAX_HISTORY = 100;
const EXTRACTOR_PASSWORD = 'Foundry123$';

// ============================
// Load extracted keys from clientStorage
// ============================
async function loadExtractedKeys() {
  try {
    const data = await figma.clientStorage.getAsync(EXTRACTED_KEYS_STORAGE);
    if (data && Array.isArray(data)) {
      extractedKeys = new Set(data.map((i: any) => i.key));
      extractedNames = new Set(data.map((i: any) => normalizeComponentName(i.name)));
      // Rebuild combined sets
      validKeys = new Set([...jsonKeys, ...extractedKeys]);
      validNames = new Set([...jsonNames, ...extractedNames]);
    }
  } catch (e) {
    // ignore
  }
}

// Load on startup
loadExtractedKeys();

figma.showUI(html, { width: 520, height: 680 });

// ============================
// Foundry Detection
// ============================
function isFoundryComponent(key: string, componentName: string, parentKey?: string, parentName?: string): boolean {
  if (validKeys.has(key)) return true;
  if (parentKey && validKeys.has(parentKey)) return true;
  const normalized = normalizeComponentName(componentName);
  if (validNames.has(normalized)) return true;
  // Also check parent COMPONENT_SET name
  if (parentName) {
    const normalizedParent = normalizeComponentName(parentName);
    if (validNames.has(normalizedParent)) return true;
  }
  return false;
}

function isFoundryIcon(key: string, componentName: string, parentKey?: string, parentName?: string): boolean {
  if (jsonIconKeys.has(key)) return true;
  if (parentKey && jsonIconKeys.has(parentKey)) return true;
  const normalized = normalizeComponentName(componentName);
  if (jsonIconNames.has(normalized)) return true;
  if (parentName) {
    const normalizedParent = normalizeComponentName(parentName);
    if (jsonIconNames.has(normalizedParent)) return true;
  }
  return false;
}

// ============================
// Message Router
// ============================
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'SCAN_PAGE') {
    await loadExtractedKeys(); // Refresh before scan
    await runFullScan();
  } else if (msg.type === 'FOCUS_NODE') {
    const node = figma.getNodeById(msg.nodeId);
    if (node) {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  } else if (msg.type === 'GET_HISTORY') {
    const history = await getHistory();
    figma.ui.postMessage({ type: 'HISTORY_RESULTS', data: history });
  } else if (msg.type === 'VERIFY_PASSWORD') {
    const valid = msg.password === EXTRACTOR_PASSWORD;
    figma.ui.postMessage({ type: 'PASSWORD_RESULT', valid });
  } else if (msg.type === 'EXTRACT_KEYS') {
    if (msg.password !== EXTRACTOR_PASSWORD) {
      figma.ui.postMessage({ type: 'EXTRACT_RESULT', success: false, message: '❌ Incorrect password' });
      return;
    }
    await runExtractor();
  } else if (msg.type === 'GET_EXTRACTED_COUNT') {
    await loadExtractedKeys();
    figma.ui.postMessage({ type: 'EXTRACTED_COUNT', count: extractedKeys.size });
  }
};

// ============================
// KEY EXTRACTOR
// ============================
async function runExtractor() {
  const extractedItems: { key: string; name: string; type: string }[] = [];
  const seenKeys = new Set<string>();

  // Walk ALL pages in the file
  for (const page of figma.root.children) {
    const allNodes = page.findAll(() => true);

    for (const node of allNodes) {
      // Extract COMPONENT_SET keys
      if ((node as any).type === 'COMPONENT_SET') {
        const csNode = node as unknown as ComponentSetNode;
        if (!seenKeys.has(csNode.key)) {
          seenKeys.add(csNode.key);
          extractedItems.push({
            key: csNode.key,
            name: csNode.name,
            type: 'COMPONENT_SET'
          });
        }
        // Also extract all child component variants
        for (const child of csNode.children) {
          if (child.type === 'COMPONENT') {
            const compNode = child as ComponentNode;
            if (!seenKeys.has(compNode.key)) {
              seenKeys.add(compNode.key);
              extractedItems.push({
                key: compNode.key,
                name: compNode.name,
                type: 'COMPONENT_VARIANT'
              });
            }
          }
        }
      }

      // Extract standalone COMPONENT keys (not inside COMPONENT_SET)
      if (node.type === 'COMPONENT') {
        const compNode = node as ComponentNode;
        if (!seenKeys.has(compNode.key) && (!compNode.parent || compNode.parent.type !== 'COMPONENT_SET')) {
          seenKeys.add(compNode.key);
          extractedItems.push({
            key: compNode.key,
            name: compNode.name,
            type: 'COMPONENT'
          });
        }
      }

      // Extract keys from INSTANCE nodes (captures remote components used in the file)
      if (node.type === 'INSTANCE') {
        try {
          const mainComp = await (node as InstanceNode).getMainComponentAsync();
          if (mainComp && !seenKeys.has(mainComp.key)) {
            seenKeys.add(mainComp.key);
            extractedItems.push({
              key: mainComp.key,
              name: mainComp.name,
              type: 'COMPONENT (via Instance)'
            });
          }
          // Also get parent COMPONENT_SET
          if (mainComp && mainComp.parent && mainComp.parent.type === 'COMPONENT_SET') {
            const parentCS = mainComp.parent as ComponentSetNode;
            if (!seenKeys.has(parentCS.key)) {
              seenKeys.add(parentCS.key);
              extractedItems.push({
                key: parentCS.key,
                name: parentCS.name,
                type: 'COMPONENT_SET (via Instance)'
              });
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  // Save to clientStorage
  try {
    await figma.clientStorage.setAsync(EXTRACTED_KEYS_STORAGE, extractedItems);
    await loadExtractedKeys(); // Reload into memory

    figma.ui.postMessage({
      type: 'EXTRACT_RESULT',
      success: true,
      message: `✅ Extracted ${extractedItems.length} keys (${seenKeys.size} unique) from "${figma.root.name}"`,
      count: extractedItems.length
    });
    figma.notify(`✅ Extracted ${extractedItems.length} keys from library`);
  } catch (e) {
    figma.ui.postMessage({ type: 'EXTRACT_RESULT', success: false, message: '❌ Failed to save: ' + e });
  }
}

// ============================
// FULL SCAN
// ============================
async function runFullScan() {
  const componentIssues: ComponentIssue[] = [];
  const tokenIssues: TokenIssue[] = [];
  const iconIssues: IconIssue[] = [];
  const extractedComponents: { key: string; name: string; type: 'FOUNDRY' | 'LEGACY' }[] = [];
  let foundryCount = 0;

  const instances = figma.currentPage.findAll(n => n.type === 'INSTANCE') as InstanceNode[];

  let loopIndex = 0;
  for (const node of instances) {
    try {
      if (loopIndex++ % 100 === 0) {
        await new Promise(r => setTimeout(r, 1));
      }

      let mainComponent = node.mainComponent;
      if (!mainComponent) {
        mainComponent = await node.getMainComponentAsync();
      }
      if (!mainComponent) continue;

      const currentKey = mainComponent.key;
      const componentName = mainComponent.name;

      let parentKey: string | undefined;
      let parentName: string | undefined;
      if (mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
        parentKey = (mainComponent.parent as ComponentSetNode).key;
        parentName = (mainComponent.parent as ComponentSetNode).name;
      }

      const isFoundryComp = isFoundryComponent(currentKey, componentName, parentKey, parentName);
      if (isFoundryComp) {
        foundryCount++;
        extractedComponents.push({ key: currentKey, name: mainComponent.name, type: 'FOUNDRY' });
      } else {
        extractedComponents.push({ key: currentKey, name: mainComponent.name, type: 'LEGACY' });
        let libraryName = 'External Library';
        try {
          if (mainComponent.remote) {
            const desc = mainComponent.description || '';
            if (desc.length > 0) libraryName = desc.split('\n')[0].trim();
          }
        } catch { /* skip */ }

        componentIssues.push({
          id: node.id,
          name: node.name,
          realName: mainComponent.name,
          libraryName,
          severity: 'critical',
          flag: { name: libraryName, color: '#E05C5C', label: libraryName },
          suggestions: []
        });
      }

      const isLikelyIcon = (node.width <= 48 && node.height <= 48) || node.name.toLowerCase().includes('icon');
      if (isLikelyIcon) {
        const isFoundryIcn = isFoundryIcon(currentKey, componentName, parentKey, parentName);
        if (isFoundryComp && !isFoundryIcn) {
          // It's a regular foundry component, completely fine
        } else if (isFoundryIcn) {
          // Compliant foundry icon
        } else {
          iconIssues.push({ nodeId: node.id, nodeName: node.name, iconName: mainComponent.name, componentKey: currentKey, isFoundry: false });
        }
      }
    } catch (e) { /* ignore */ }
  }

  // ─── Token Linter ───
  const autoLayoutNodes = figma.currentPage.findAll(n => {
    if (n.type !== 'FRAME' && n.type !== 'COMPONENT' && n.type !== 'INSTANCE') return false;
    const frame = n as FrameNode;
    return frame.layoutMode !== undefined && frame.layoutMode !== 'NONE';
  }) as FrameNode[];

  for (const node of autoLayoutNodes) {
    const checks: [string, number][] = [
      ['paddingTop', node.paddingTop],
      ['paddingRight', node.paddingRight],
      ['paddingBottom', node.paddingBottom],
      ['paddingLeft', node.paddingLeft],
      ['itemSpacing', node.itemSpacing],
    ];
    for (const [prop, val] of checks) {
      if (val === 0 || val === undefined || val === null) continue;
      if (!FOUNDRY_SPACING_SCALE.includes(val)) {
        tokenIssues.push({ nodeId: node.id, nodeName: node.name, property: prop, actualValue: val, nearestToken: findNearestToken(val) });
      }
    }
  }

  // ─── Summary ───
  const totalInstances = foundryCount + componentIssues.length;
  const summary: ScanSummary = {
    totalInstances, foundryCount,
    legacyCount: componentIssues.length,
    tokenErrors: tokenIssues.length,
    iconErrors: iconIssues.length,
    healthScore: totalInstances > 0 ? Math.round((foundryCount / totalInstances) * 100) : 100,
  };

  const results: ScanResults = { componentIssues, tokenIssues, iconIssues, summary, extractedComponents };
  await saveSnapshot(results);
  figma.ui.postMessage({ type: 'SCAN_RESULTS', data: results });
  figma.notify(`🛡️ Scan complete: ${summary.healthScore}% Foundry adoption`);
}

// ============================
// Helpers
// ============================
function findNearestToken(value: number): number {
  let nearest = FOUNDRY_SPACING_SCALE[0];
  let minDiff = Math.abs(value - nearest);
  for (const token of FOUNDRY_SPACING_SCALE) {
    const diff = Math.abs(value - token);
    if (diff < minDiff) { minDiff = diff; nearest = token; }
  }
  return nearest;
}

async function saveSnapshot(results: ScanResults): Promise<void> {
  try {
    const history = await getHistory();
    const snapshot: AnalyticsSnapshot = {
      timestamp: Date.now(),
      fileName: figma.root.name,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
      foundryCount: results.summary.foundryCount,
      legacyCount: results.summary.legacyCount,
      tokenErrorCount: results.summary.tokenErrors,
      iconErrorCount: results.summary.iconErrors,
      extractedComponents: results.extractedComponents
    };
    history.push(snapshot);
    await figma.clientStorage.setAsync(STORAGE_KEY, history.slice(-MAX_HISTORY));
  } catch (e) { /* ignore */ }
}

async function getHistory(): Promise<AnalyticsSnapshot[]> {
  try {
    const data = await figma.clientStorage.getAsync(STORAGE_KEY);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}