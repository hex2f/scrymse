import './style.css'
import * as zip from '@zip.js/zip.js';
import toast from './toaster';
import { cards, parseMse } from './mse-reader';
import { fmt, parseMana } from './mse-html-fmt';

const uploadPanel = document.getElementById('upload-panel')!
const resultsPanel = document.getElementById('results-panel')!
const cptList = document.getElementById('cpt-list')!
const copyAllBtn = document.getElementById('copy-all-btn')!
const downloadTxtBtn = document.getElementById('download-txt-btn')!
const uploadAgainBtn = document.getElementById('upload-again-btn')!
const fileInput = document.getElementById('file-input') as HTMLInputElement

function showUploadView() {
  uploadPanel.classList.remove('hidden')
  resultsPanel.classList.add('hidden')
  cptList.replaceChildren()
}

function safeTxtFilename(setFileName: string | undefined): string {
  const raw = (setFileName ?? 'cards').replace(/^.*[/\\]/, '').replace(/\.mse-set$/i, '').trim() || 'cards'
  const safe = raw.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'cards'
  return `${safe}.txt`
}

function showResultsView(cpts: string[], setFileName?: string) {
  cptList.replaceChildren()
  uploadPanel.classList.add('hidden')
  resultsPanel.classList.remove('hidden')

  const markCopied = (el: HTMLElement) => {
    el.classList.add('is-copied')
    const badge = el.querySelector('.cpt-copied-badge')
    if (badge) badge.classList.remove('hidden')
  }

  for (let i = 0; i < cpts.length; i++) {
    const text = cpts[i]
    const block = document.createElement('button')
    block.type = 'button'
    block.className =
      'cpt-block group relative w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'

    const textEl = document.createElement('span')
    textEl.className = 'block pr-20 font-mono text-sm text-slate-800 whitespace-pre-wrap break-words'
    textEl.textContent = text
    block.appendChild(textEl)

    const badge = document.createElement('span')
    badge.className =
      'cpt-copied-badge pointer-events-none select-none absolute right-3 top-3 hidden rounded-md bg-slate-200/90 px-2 py-0.5 text-xs font-sans font-medium text-slate-600'
    badge.textContent = 'Copied'
    block.appendChild(badge)

    block.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text)
        markCopied(block)
        toast('Copied to clipboard', 'success')
      } catch {
        toast('Could not copy', 'error')
      }
    })

    cptList.appendChild(block)
  }

  copyAllBtn.onclick = async () => {
    const combined = cpts.join('\n\n')
    try {
      await navigator.clipboard.writeText(combined)
      cptList.querySelectorAll('.cpt-block').forEach((el) => markCopied(el as HTMLElement))
      toast('All cards copied to clipboard', 'success')
    } catch {
      toast('Could not copy', 'error')
    }
  }

  downloadTxtBtn.onclick = () => {
    const combined = cpts.join('\n\n')
    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = safeTxtFilename(setFileName)
    a.click()
    URL.revokeObjectURL(url)
    toast('Download started', 'success')
  }
}

uploadAgainBtn.addEventListener('click', () => {
  fileInput.value = ''
  showUploadView()
})

fileInput.addEventListener('change', async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const zipReader = new zip.ZipReader(new zip.BlobReader(file))
  try {
    const entries = await zipReader.getEntries()
    const mseSet = entries.find(entry => entry.filename === 'set')
    if (!mseSet) {
      toast('The .mse-set file is not found', 'error')
      return
    }
    const mseSetText = await (mseSet as zip.FileEntry).getData(new zip.TextWriter())
    const mseSetJson = cards(parseMse(mseSetText))
    console.log(JSON.stringify(mseSetJson, null, 2))
    let cpts = [] // copy pastable texts
    for (const card of mseSetJson) {
      if (!card.name || fmt(card.name).length === 0) continue
      let cpt = ""

      // name (duh)
      cpt += fmt(card.name)

      // casting cost
      if ('casting_cost' in card) {
        cpt += ' '
        for (const cost of parseMana(card.casting_cost)) {
          cpt += `{${cost}}`
        }
      }

      // super type (artifact, creature, etc)
      if ('super_type' in card || 'sub_type' in card) {
        cpt += '\n'
        if ('super_type' in card) {
          const superType = fmt(card.super_type)
          if (superType.length > 0) {
            cpt += superType
          }
        }
        if ('sub_type' in card) {
          const subType = fmt(card.sub_type)
          if (subType.length > 0) {
            cpt += ` — ${subType}`
          }
        }
      }

      // rule text, we only add it if it's not empty
      if ('rule_text' in card) {
        let ruleText = fmt(card.rule_text)
        if (ruleText.length > 0) {
          cpt += `\n${ruleText}`
        }
      }

      // planeswalker loyalty stuffs
      if ('loyalty_cost_1' in card) {
        let lvl = 1
        while (`loyalty_cost_${lvl}` in card || `level_${lvl}_text` in card) {
          const cost = card[`loyalty_cost_${lvl}`]
          const text = card[`level_${lvl}_text`]
          if (!((cost && cost.toString().length > 0) || (text && text.toString().length > 0))) {
            break
          }

          cpt += '\n'

          if (cost && cost.toString().length > 0) {
            cpt += `${fmt(cost)}: `
          }
          if (text && text.toString().length > 0) {
            cpt += fmt(text)
          }
          lvl++
        }
      }

      // loyalty or p/t
      if ('loyalty' in card) {
        cpt += `\nLoyalty: ${fmt(card.loyalty)}`
      } else if ('power' in card && 'toughness' in card) {
        cpt += `\n${fmt(card.power)}/${fmt(card.toughness)}`
      }

      cpts.push(cpt)
    }

    if (cpts.length === 0) {
      toast('No cards found in this set', 'warning')
      return
    }
    showResultsView(cpts, file.name)
  } catch (error) {
    toast('Error parsing the .mse-set file', 'error')
    console.error(error)
  } finally {
    await zipReader.close();
  }
});