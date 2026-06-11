const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, ExternalHyperlink, LevelFormat
} = require('docx');
const fs = require('fs');

// ─── helpers ──────────────────────────────────────────────────────────────────

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 120 },
    children: [new TextRun({ text, bold: true, size: 40, font: 'Arial' })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 100 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial' })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial' })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text, size: 24, font: 'Arial', ...opts })]
  });
}

function pRich(runs) {
  return new Paragraph({
    spacing: { before: 0, after: 160 },
    children: runs.map(r => {
      if (typeof r === 'string') return new TextRun({ text: r, size: 24, font: 'Arial' });
      return new TextRun({ size: 24, font: 'Arial', ...r });
    })
  });
}

function quote(text) {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    indent: { left: 720, right: 720 },
    border: {
      left: { style: BorderStyle.THICK, size: 8, color: 'E05A00', space: 10 }
    },
    children: [new TextRun({ text, italics: true, size: 24, font: 'Arial', color: '333333' })]
  });
}

function meta(label, value) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Arial', color: '555555' }),
      new TextRun({ text: value, size: 20, font: 'Arial', color: '555555' })
    ]
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 240, after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 } },
    children: []
  });
}

function sectionHeader(num, title, platform) {
  return [
    divider(),
    new Paragraph({
      spacing: { before: 480, after: 40 },
      children: [
        new TextRun({ text: `ARTICLE ${num}`, bold: true, size: 22, font: 'Arial', color: 'E05A00', allCaps: true }),
        new TextRun({ text: `  ·  `, size: 22, font: 'Arial', color: '999999' }),
        new TextRun({ text: platform, size: 22, font: 'Arial', color: '888888' })
      ]
    }),
    h1(title),
    new Paragraph({ spacing: { before: 0, after: 240 }, children: [new TextRun({ text: 'By Francis E. Umesiri  ·  Axitos Publishing House  ·  June 2026', size: 20, font: 'Arial', color: '888888', italics: true })] }),
  ];
}

function schemaBox(label, code) {
  return [
    h3(label),
    new Paragraph({
      spacing: { before: 80, after: 80 },
      shading: { fill: 'F4F4F4', type: ShadingType.CLEAR },
      children: [new TextRun({ text: code, size: 18, font: 'Courier New', color: '333333' })]
    }),
  ];
}

// ─── ARTICLE CONTENT ──────────────────────────────────────────────────────────

const children = [];

// ── COVER PAGE ──
children.push(
  new Paragraph({ spacing: { before: 1440, after: 80 }, children: [new TextRun({ text: 'AXITOS PUBLISHING HOUSE', bold: true, size: 28, font: 'Arial', color: 'E05A00', allCaps: true })] }),
  new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: 'Six Authoritative Articles on AI, Publishing & Editorial Integrity', size: 36, font: 'Arial', bold: true })] }),
  new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: 'Prepared by Francis E. Umesiri', size: 24, font: 'Arial', italics: true })] }),
  new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: 'June 2026', size: 24, font: 'Arial', color: '888888' })] }),
  divider(),
  new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: 'Platforms covered:', bold: true, size: 22, font: 'Arial' })] }),
  new Paragraph({ spacing: { before: 0, after: 20 }, children: [new TextRun({ text: 'Articles 1 & 6  ·  Axitos Website  |  Article 2 & 5  ·  LinkedIn  |  Article 3  ·  Substack  |  Article 4  ·  Medium', size: 22, font: 'Arial', color: '555555' })] }),
  new Paragraph({ spacing: { before: 240, after: 0 }, children: [new PageBreak()] })
);

// ═══════════════════════════════════════════════════════════════
// ARTICLE 1 — Axitos Website
// Beyond Spellcheck: How AI Is Reshaping the Editorial Process
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(1, 'Beyond Spellcheck: How AI Is Reshaping the Editorial Process', 'AXITOS WEBSITE'));

children.push(
  meta('Meta Title', 'Beyond Spellcheck: How AI Is Reshaping the Editorial Process | Axitos'),
  meta('Meta Description', 'AI has transformed every surface-level editing task. But the central editorial question — does this book say what it needs to say? — remains irreducibly human. A research-grounded analysis for authors and publishers.'),
  meta('Slug', '/beyond-spellcheck-ai-reshaping-editorial-process'),
  meta('Target Keywords', 'AI editing tools publishing, AI in the editorial process, AI and book editing 2026, human editors vs AI, generative AI publishing'),
  divider(),
);

// Article 1 body
const art1 = [
  h2('What Has Actually Changed in the Editing Process — and What Has Not'),
  p('AI has permanently changed the logistics of editing. It has not changed what editing is actually for. Modern AI tools can catch spelling errors in milliseconds, flag sentence-level awkwardness, identify repetition across tens of thousands of words, generate alternative phrasings on demand, and condense a chapter to its argument in seconds. Those tasks used to take editors hours. They now take moments. That shift is real, measurable, and irreversible. But it leaves the central editorial question entirely untouched: does this book say what the author needs it to say, in a way that will reach and move its intended readers?'),
  p('That question has no algorithmic answer. It never did. The tools that automate the surface have, if anything, made the human layer more visible — and more valuable.'),

  h2('The State of AI Editing Tools in 2026: A Landscape Overview'),
  p('The AI writing and editing tool market was estimated at approximately $2 billion in 2025 and is projected to reach roughly $10 billion by 2033, growing at a compound annual growth rate near 25%, according to market analysis published by Data Insights Market in February 2026. That expansion is being driven by adoption at every level of the publishing chain, from solo indie authors to the major houses.'),
  p('The landscape currently organizes itself into several distinct categories, each with its own strengths, limitations, and suitability for different kinds of editorial work.'),

  h3('Grammar and Style Correction Tools'),
  p('Grammarly (now operating under the Superhuman umbrella following a rebranding in October 2025) and ProWritingAid remain the dominant players in grammar and style correction. Grammarly is faster and more user-friendly for general editing across many document types. ProWritingAid runs deeper, offering more than twenty specialized reports covering pacing, sentence-length variation, dialogue tags, repeated phrasing, and readability — all analyzed at the manuscript level rather than sentence by sentence. Testing by Manuscript Report in 2026 found that Grammarly consistently catches more typographic errors, while ProWritingAid provides superior analysis of structural style across long-form work. For book-length manuscripts, the recommended workflow is ProWritingAid first, then Grammarly as a final-pass check.'),
  p('Both tools have moved well beyond spellcheck. What neither can do is tell an editor whether a chapter serves the book\'s argument, whether the emotional arc resolves honestly, or whether a particular scene contradicts the author\'s established voice three chapters earlier.'),

  h3('Genre-Specific Manuscript Analysis'),
  p('AutoCrit occupies a distinctive position in the market. Rather than measuring writing against general quality standards, it compares manuscripts against bestselling authors in the same genre. A thriller author can measure their pacing against Lee Child; a romance writer can benchmark their emotional beats against established patterns in that category. This is genuinely useful for commercial fiction writers preparing for market, and it represents a level of contextual intelligence that generic tools cannot replicate. The limitation is the same limitation that applies to all benchmarking: it measures conformity to what has already worked. Work that breaks patterns intentionally will look like a problem.'),

  h3('AI-Assisted Developmental Analysis'),
  p('Authors A.I. (Marlowe) and Sudowrite have pushed into developmental territory — the kind of analysis that traditionally required a developmental editor to spend days inside a manuscript. Marlowe generates reports on character arcs, plot structure, pacing, and market positioning. Sudowrite\'s Story Engine helps authors expand plot beats into fully drafted scenes while ostensibly maintaining a specified style. These tools are the most capable AI systems currently available for structural editorial work, and they are also the ones most likely to produce homogenized output if used without strong authorial oversight.'),

  h2('What the Research Actually Shows About AI and Writing Quality'),
  p('The research picture is more sobering than most tool vendors acknowledge. A 2025 National Bureau of Economic Research working paper by Reimers and Waldfogel (NBER w34777) found that the proliferation of large language models from 2022 to 2025 roughly tripled the volume of new book releases, while also finding that books with significant AI-generated content show lower quality measured by reader usage and engagement. By their analysis, AI-containing books had come to represent more than half of 2025 releases — and their rising share was the primary driver of a measurable decline in average book quality across the market.'),
  p('That finding does not indict AI as a writing tool. It describes what happens when AI replaces editorial judgment rather than supporting it. The distinction is everything.'),
  p('The same period brought a striking counterpoint from the scholarly publishing world. A 2025 analysis published in Frontiers in Research Metrics and Analytics examined how major publishers were responding to AI-generated manuscripts, finding that the response across the industry was not to abandon AI tools but to codify human accountability around them. The Committee on Publication Ethics (COPE), the International Committee of Medical Journal Editors (ICMJE), and the World Association of Medical Editors all converged on a similar principle: AI may assist, but it cannot assume authorship or accountability, and its use must be disclosed. That framework — AI as assistant, human as accountable author — is now the operating standard across both scholarly and trade publishing.'),

  h2('The Editorial Gap That AI Cannot Close'),
  p('There is a specific kind of editorial intelligence that no current AI system possesses: the ability to understand what a particular author is trying to accomplish and to judge whether the manuscript is achieving it — not in the abstract, but for the specific readership and purpose the author has in mind.'),
  p('An editor who has worked across fifty manuscripts in a category knows, by something that functions more like intuition than algorithm, when a chapter\'s placement is wrong, when a scene lacks the energy the narrative needs at that moment, when a character has stopped feeling real to the reader even if the prose describing them is technically clean. That knowledge is pattern-matched across years of reading and judgment, calibrated to the emotional responses of real audiences, and anchored in genuine understanding of why people read in the first place.'),
  p('People read because they want to feel something, understand something, or see their world from a vantage point they haven\'t occupied before. A book that fails at those goals fails editorially, regardless of how clean its grammar is. A machine can measure sentence complexity. It cannot measure whether a paragraph will make a reader stop and reconsider a long-held assumption.'),

  h2('What the AI Era Has Actually Made Editors Do'),
  p('The practical effect of AI tools on editorial workflows has been measurable and largely positive for the editors who have integrated them thoughtfully. The North American manuscript editing services market was valued at $2.5 billion in 2024 and is projected to reach $4 billion by 2033, according to market data from Verified Market Reports published in May 2026. That growth suggests demand for editorial services is not collapsing under AI pressure — it is expanding alongside it.'),
  p('The explanation is straightforward. When AI handles the mechanical pass, editors spend less time marking repeated words and more time doing the work that actually shapes books: restructuring arguments, sharpening voice, identifying where an author\'s genuine insight is being obscured by draft-level language, and making the judgment calls that determine whether a manuscript becomes a book worth reading.'),
  p('A 2025 survey published in Editage Insights found that journal editors across the industry were adopting AI tools selectively — applying automation to screening, compliance checking, and basic clarity review — while maintaining human judgment as the standard for peer review, editorial selection, and narrative assessment. The pattern holds across trade publishing: AI takes the mechanical load, editors take the judgment load. The judgment load is where the value was always located.'),

  h2('The New Risk: When AI Erases Voice'),
  p('There is one editorial challenge that AI has actively introduced rather than solved: the homogenization of prose. When a large portion of the author community uses the same tools trained on the same data, the output tends to converge toward stylistic patterns the models have seen most frequently. Phrases become predictable. Sentence structures repeat. The idiosyncrasies that distinguish a specific author\'s sensibility — the things readers actually form attachment to — get smoothed away.'),
  p('Readers often cannot name what is making a piece feel generic. They just feel it. They may complete the book, but they won\'t recommend it. They won\'t remember it. The book becomes competent and forgettable rather than memorable and influential.'),
  p('This is where the editor\'s work becomes both harder and more essential. Working with an author who has used AI extensively in drafting requires the editor to do something almost archaeological: finding the places where the author\'s actual sensibility breaks through the AI\'s normalizing influence and rebuilding the draft around those moments. The goal is not to produce a perfect manuscript. It is to produce an unmistakably human one.'),

  h2('Practical Guidance: What Authors Should Know'),
  p('The Authors Guild AI survey of December 2023 (n=2,400+) found that more than 90% of authors wanted consent and compensation when their work is used to train AI. That figure reflects how seriously the writing community views the value of their own voice and judgment — and it suggests a useful framework for thinking about AI use in your own work.'),
  p('Use AI for the mechanical. Reserve yourself for the human. Specifically:'),
  p('Run your draft through ProWritingAid or Grammarly for style and grammar — but read every suggestion before accepting it. Not every suggestion improves your writing. Many flatten it.'),
  p('Use AI to generate alternatives when you\'re stuck on a sentence or passage — but treat those alternatives as prompts for your own thinking, not finished options. The AI\'s version is a starting point, not an endpoint.'),
  p('Do not use AI to write sections you haven\'t thought through yourself. The quality of AI-assisted writing is directly proportional to the clarity of the author\'s thinking coming in. Vague input produces polished vagueness.'),
  p('Keep a human editor in the loop for anything that will carry your professional reputation. AI tools and human editorial judgment are not substitutes for each other. They are complements — and the combination is more powerful than either alone.'),

  h2('Looking Forward: The Ten-Year Editorial Horizon'),
  p('The trajectory over the next decade is not editorial jobs disappearing. It is editorial work being reorganized around different centers of value. The Lumina Datamatics 2026 publishing trends analysis identified AI-driven editorial systems performing smart copyediting, metadata tagging, and sentiment analysis as already standard across major publishers. That trend will continue and deepen.'),
  p('What will not be automated is strategic editorial thinking: the decision about whether a book is ready for its audience, whether its argument is genuinely original, whether its voice is distinctive enough to survive in a market flooded with AI-generated content, and whether its author\'s ideas have the authority to sustain a reader\'s trust across 250 pages. Those decisions require people. They always have. They will for the foreseeable future.'),
  p('The editing question has not changed. The tools that inform the answer keep changing. Learning to use the tools without letting them answer the question for you — that is the editorial skill of this decade.'),

  h2('References'),
  p('Reimers, I., & Waldfogel, J. (2025). Creative destruction in the AI era: Evidence from book publishing. NBER Working Paper No. 34777. National Bureau of Economic Research.'),
  p('Data Insights Market. (2026, February 5). AI Writing Tool Charting Growth Trajectories: Analysis and Forecasts 2026–2034.'),
  p('Verified Market Reports. (2026, May). Global Manuscript Editing Services Market Size, Industry Trends & Forecast 2026–2034.'),
  p('Frontiers in Research Metrics and Analytics. (2026, April 24). Use of artificial intelligence tools in the publishing process: expectations from publishers through author guidelines. doi:10.3389/frma.2026.1740510'),
  p('Committee on Publication Ethics. (2025). Emerging AI dilemmas in scholarly publishing. COPE Forum, July 2025.'),
  p('Editage Insights. (2025, December 18). Publishing trends in 2026: AI, open science, and peer review.'),
  p('Lumina Datamatics. (2026, April 21). Top 10 publishing trends to watch out for in 2026.'),
  p('Baldacci, D. (2025, July 16). Questions for the Record, Senate Judiciary Subcommittee on Crime and Counterterrorism. U.S. Senate.'),
  p('Authors Guild. (2023, December). Survey on AI and Authors\' Livelihoods (n=2,400+). Authors Guild.'),
  p('Aggarwal, P., Murahari, V., Rajpurohit, T., Kalyan, A., Narasimhan, K., & Deshpande, A. (2024). GEO: Generative engine optimization. Proceedings of the 30th ACM SIGKDD Conference on Knowledge Discovery and Data Mining, 41–51. https://doi.org/10.1145/3637528.3671900'),

  ...schemaBox('JSON-LD Schema (Article — for Axitos website)',
`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Beyond Spellcheck: How AI Is Reshaping the Editorial Process",
  "description": "AI has transformed every surface-level editing task. But the central editorial question remains irreducibly human.",
  "author": {
    "@type": "Person",
    "name": "Francis E. Umesiri",
    "url": "https://www.axitos.ai/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Axitos Publishing House",
    "url": "https://www.axitos.ai"
  },
  "datePublished": "2026-06-11",
  "mainEntityOfPage": "https://www.axitos.ai/beyond-spellcheck-ai-reshaping-editorial-process"
}`),
];
children.push(...art1);
children.push(new Paragraph({ children: [new PageBreak()] }));


// ═══════════════════════════════════════════════════════════════
// ARTICLE 2 — LinkedIn
// The Mistake Most Publishing Content Makes
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(2, 'The Mistake Most Publishing Content Makes', 'LINKEDIN'));
children.push(
  meta('Format', 'LinkedIn Post (short-form, no headers, conversational)'),
  meta('Objective', 'Audience clarity, thought leadership, indirect Axitos positioning'),
  meta('Tone', 'Direct. Practitioner. No filler.'),
  divider(),
);

const art2 = [
  p('Most publishing content has an audience problem, not a content problem.'),
  p('Publishers write blog posts, newsletters, and LinkedIn posts without first answering the only question that determines whether any of it works: who is this for?'),
  p('When you write for everyone, you write for no one. That is not a metaphor. It is a measurable outcome. Content that does not address a specific person\'s specific concern gets scrolled past. Not because the writing is bad. Because it carries no sense of recognition — no moment where the reader thinks, yes, that is exactly my situation.'),
  p('The authors most publishers are actually trying to reach — executives with twenty years of accumulated knowledge, consultants with genuine intellectual frameworks, academics and medical professionals who have something worth saying — are not searching for generic publishing information. They have a specific fear: that they will publish a book and it will disappear. That their ideas will never find the people who need them most.'),
  p('Their questions are strategic, not procedural. Not "how do I format a manuscript" but "how does a book build credibility in a field where AI is increasingly mediating what gets found?" Not "what is an ISBN" but "will my book still be discoverable in five years, or will it be invisible to the recommendation systems readers now rely on?"'),
  p('Readers are looking for something different from authors. They want books worth their time — not publishing industry content. They are part of a community of trust, and when a book reaches them through a trusted source, the recommendation carries weight that no advertisement can replicate.'),
  p('Then there is the smaller but consequential group of editors, publishing consultants, and journalists who influence the entire ecosystem. They do not respond to promotional language. They respond to honest analysis. Earning their respect requires saying things that are true and useful, not things that make your company sound impressive.'),
  p('Three different audiences. Three completely different definitions of value. The mistake is treating them as one.'),
  p('The publishers who understand this write for one audience at a time, with enough substance to draw the others in.'),
  p('Publishing is about connecting ideas with the people who need them. Every piece of content is either moving that connection forward or getting in the way of it.'),
  p('Which is yours doing?'),
  p('#Publishing #AuthorAuthority #ContentStrategy #ThoughtLeadership #BookPublishing'),
];
children.push(...art2);
children.push(new Paragraph({ children: [new PageBreak()] }));


// ═══════════════════════════════════════════════════════════════
// ARTICLE 3 — Substack
// The Editor's New Toolkit: Integrating AI Without Losing the Human Voice
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(3, "The Editor's New Toolkit: Integrating AI Without Losing the Human Voice", 'SUBSTACK'));
children.push(
  meta('Meta Title', "The Editor's New Toolkit: AI, Voice, and What Actually Makes a Book Worth Reading"),
  meta('Meta Description', 'AI has changed the tools. The question editors ask — does this book say what it needs to say? — has not. A practitioner guide to integrating AI without erasing the author.'),
  meta('Tone', 'Warm, candid, practitioner-to-practitioner'),
  divider(),
);

const art3 = [
  p('There is a conversation editors keep having with each other that the public version of the AI-in-publishing debate misses entirely. It is not the conversation about whether AI will take our jobs. Most working editors are not particularly anxious about that question. The more interesting question — the one that actually shapes what we do every day — is more specific: what do I do when a manuscript has clearly been processed through an AI tool, and the author\'s voice has been partially erased in the process?'),
  p('That question did not exist five years ago. It is now one of the most common challenges in editorial work.'),

  h2('What AI Tools Are Actually Doing in Editorial Workflows'),
  p('To understand the challenge, it helps to be clear about what AI tools are genuinely good at, because the list is not trivial. ProWritingAid offers manuscript-level analysis across more than twenty dimensions: sentence length variation, pacing, repeated phrasing, sticky sentences, dialogue balance, readability. AutoCrit benchmarks fiction manuscripts against genre bestsellers, giving authors quantified feedback on whether their pacing, tension, and word choices fall within the range readers of that category expect. Grammarly catches the mechanical errors that slip through human review. Sudowrite\'s Story Engine can take a plot outline and expand it into drafted scenes.'),
  p('These capabilities have genuinely changed the pace of editorial work. A task that once required two days of close reading to produce a structural assessment can now be partially scaffolded in hours. That compression is real and it is useful.'),
  p('But tools like these operate on pattern. They recognize what has appeared frequently in their training data and flag departures from it. That is exactly what makes them valuable for catching errors and exactly what makes them dangerous for voice.'),

  h2('Why the Voice Problem Is Getting Worse'),
  p('The NBER working paper by Reimers and Waldfogel (2025, working paper w34777) offered a data-level portrait of what AI adoption at scale looks like in publishing. Their analysis found that the diffusion of large language models roughly tripled new book releases between 2022 and 2025, while also documenting a measurable decline in average book quality by usage metrics, concentrated in AI-containing books. By mid-2025, such books represented more than half of all new releases.'),
  p('What the data captures is something editors have been noticing in their queues: manuscripts that are technically clean and structurally organized but somehow depleted. The prose has been optimized toward a statistical center — the most frequent patterns in large training datasets — at the expense of the particularities that make an author sound like themselves. Sentences are well-formed. Paragraphs have topic sentences. Arguments proceed in recognizable order. And somehow the manuscript feels like no one actually wrote it.'),
  p('Readers notice. They may not be able to say what is wrong. They say the book felt smooth but cold, or they put it down halfway through for no reason they can explain. The reason is that there was no specific human sensibility holding the thing together — just statistically probable prose.'),

  h2('What Good Editing Does That AI Cannot'),
  p('The Committee on Publication Ethics, in its July 2025 forum on AI dilemmas in scholarly publishing, articulated the principle that has governed serious editorial work forever: AI may assist, but it cannot assume authorship or accountability. That principle applies equally to trade publishing, though the stakes look different. In trade books, the failure is not scientific fraud; it is irrelevance. A book that no reader finds memorable or recommendable has failed at the one thing books exist to do.'),
  p('Good editing asks a different kind of question than AI tools ask. Not: does this sentence conform to expected patterns? But: does this sentence sound like this author, making this particular point, to this particular reader? Is this the chapter that earns the emotional resolution the reader has been building toward? Does this argument hold up under the kind of skeptical reading a serious reader will give it?'),
  p('Those questions require an editor to carry the reader\'s experience across the entire manuscript — to hold hundreds of pages in memory and notice when something three chapters back makes something here feel dishonest. No AI system can do that. The context windows of the best current models are impressive. What they lack is not context length but genuine comprehension of why readers form attachments to particular books and not others.'),

  h2('The Workflow That Actually Works'),
  p('The editors doing the best work with AI tools right now are using them in a specific sequence. AI for the pass that identifies mechanical problems: grammatical errors, structural repetition, pacing that falls outside genre norms, readability issues. Human judgment for everything that follows: argument structure, voice consistency, emotional arc, the judgment calls that determine whether a manuscript is ready for its audience.'),
  p('That sequencing matters. If AI runs first, the editor arrives at a cleaner manuscript with the mechanical problems already cleared — which means they can spend their time on the work that cannot be automated. If AI runs last, or if the author has used AI extensively in drafting before the editor sees the manuscript, the editor may find themselves doing archaeology: digging through technically polished prose to find the places where the author\'s actual sensibility is visible, and rebuilding the draft around those moments.'),
  p('The best authors who use AI in drafting know they are generating raw material, not finished prose. They treat AI output the way a sculptor treats a rough block of stone: as something to be carved into shape, not something to be exhibited as found. The authors who struggle are the ones who treat polished AI output as finished work. The difference shows.'),

  h2('What This Means for Editorial Integrity'),
  p('In March 2026, a survey published in Frontiers in Research Metrics and Analytics examined how major publishers were codifying AI use in their author guidelines. The pattern was consistent: AI may be used as a tool, but the author must verify all factual content, must disclose AI involvement, and retains full accountability for the work. In early 2026, Hachette UK pulled a contracted title — Shy Girl by Mia Ballard — after readers identified suspected AI use and the author acknowledged AI involvement in editing. It was one of the first major cases of a traditional publisher publicly withdrawing a title over AI concerns. The decision sent a clear signal about where the editorial standard sits.'),
  p('The Authors Guild launched its Human Authored Certification program in January 2025, expanding it to non-members in early 2026 in partnership with the UK\'s Society of Authors. That program exists because there is market demand for the certification — readers and buyers want to know when a book was written by a human author. That demand is itself data about what editorial integrity means to the market.'),

  h2('The Practical Bottom Line for Authors and Editors'),
  p('AI tools are now standard editorial instruments, much the way spellcheckers were by the mid-1990s. Using them is not a question. The question is what layer of work you bring to bear after they run.'),
  p('The author\'s job is to know what they are trying to say well enough that AI assistance sharpens their expression of it without replacing it. The editor\'s job is to ensure that the author\'s voice is not only present but strong enough to do the work the book needs it to do.'),
  p('Neither of those jobs has changed. The tools available to support them have changed dramatically. Knowing the difference — between what the tools can do and what judgment requires — is the editorial skill that matters now.'),

  h2('References'),
  p('Reimers, I., & Waldfogel, J. (2025). NBER Working Paper No. 34777.'),
  p('Frontiers in Research Metrics and Analytics. (2026). doi:10.3389/frma.2026.1740510'),
  p('Committee on Publication Ethics. (2025). AI Forum, Publication Integrity Week 2025.'),
  p('Jane Friedman. (2026, March 24). AI and Publishing: FAQ for Writers.'),
  p('Authors Guild. (2025, January). Human Authored Certification program launch.'),
];
children.push(...art3);
children.push(new Paragraph({ children: [new PageBreak()] }));


// ═══════════════════════════════════════════════════════════════
// ARTICLE 4 — Medium
// Traditional Standards in a Digital Age: Why Editorial Integrity Still Wins
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(4, 'Traditional Standards in a Digital Age: Why Editorial Integrity Still Wins', 'MEDIUM'));
children.push(
  meta('Meta Title', 'Why Editorial Integrity Still Wins in the AI Age | Francis E. Umesiri'),
  meta('Meta Description', 'Content is abundant. Trust is scarce. The publishers who understand that distinction — and build their work around it — are positioned to matter in 2026 and well beyond.'),
  meta('Tone', 'Thoughtful, essayistic, grounded in evidence'),
  divider(),
);

const art4 = [
  p('There is an easy version of the AI-in-publishing story, and it goes like this: AI makes content production faster and cheaper, the industry adapts, and life goes on more efficiently than before. That story is true as far as it goes. What it misses is what has happened to trust.'),
  p('When content was scarce and difficult to produce, the act of publication carried implicit quality signals. Getting published meant someone with editorial judgment had decided your work was worth printing and distributing. Readers could use the fact of publication as a rough proxy for reliability. That proxy is no longer functional. The total number of U.S. books published with ISBN numbers jumped 32.5% between 2024 and 2025, according to Bowker data. The NBER working paper by Reimers and Waldfogel (2025, w34777) documented that this volume surge was accompanied by a measurable decline in average book quality. More books, with less average value per book, in a market where readers still have only so many hours to read.'),
  p('In that environment, trust becomes the scarcest and most valuable thing a publisher or author can build.'),

  h2('What Editorial Integrity Actually Means in Practice'),
  p('Editorial integrity is not a mood or a brand posture. It is a specific set of practices. A manuscript goes through developmental editing that challenges its argument, not just its prose. A copy editor who knows the subject reads for factual accuracy, not just grammar. A final proofread is conducted by someone who did not write or develop the book. The author is asked hard questions before publication, not after. Those practices take time and cost money. They also produce books that hold up under scrutiny — books that readers can trust, recommend, and return to.'),
  p('The comparison to AI-assisted production is not about speed or cost. It is about what the reader receives. A reader who picks up a book produced with serious editorial rigor gets something that has been shaped by multiple layers of human judgment: an author with genuine expertise, editors who tested that expertise, and a publication decision made by people with reputational stake in the outcome. That chain of human accountability is what makes the book trustworthy.'),
  p('AI cannot replace any link in that chain. It can accelerate some of the work that feeds into it. The chain itself requires people.'),

  h2('The Trust Economy in Publishing: What the Data Shows'),
  p('The global generative AI market was valued at $103.58 billion in 2025 and is projected to reach $161 billion in 2026, according to Fortune Business Insights. That growth is not happening in isolation from publishing. AI systems are now actively mediating how readers discover books. According to data from Superlines (March 2026), Google AI Overviews reach 1.5 billion monthly users, 810 million people use ChatGPT daily, and approximately 93% of AI search sessions end without a traditional website click. When a reader asks an AI assistant to recommend books on a topic, the AI generates a short list from its training data and retrieval systems. Books that are not present in those systems with clear, authoritative, well-structured information simply do not appear.'),
  p('That shift makes editorial credibility a discovery signal, not just a quality signal. AI systems weight content by authority markers: citations in reputable outlets, library holdings, structured metadata, presence in reference systems. A book produced with genuine editorial rigor is more likely to carry those markers than one assembled at scale with AI assistance. The same editorial work that produces a trustworthy book for readers also produces the authority signals that make it findable to AI.'),

  h2('What U.S. Publishers Are Actually Doing'),
  p('The publishing industry\'s response to AI has been more nuanced than the simplest versions of the story suggest. A February 2026 analysis by WriterCosmos noted that U.S. publishers are increasingly emphasizing human authorship as a competitive advantage, with rising demand for experienced editors, investigative journalists, and ghostwriters. The same analysis found that New York lawmakers introduced legislation requiring news organizations to disclose significant AI involvement in published content and to ensure human editorial oversight — a regulatory signal that reflects public concern about AI-generated information quality.'),
  p('Two of the Big Five publishers have staked out public positions on AI training: Penguin Random House has opposed training on its content without license; HarperCollins has entered licensing arrangements. The other three have not published equivalent policies as of June 2026. That divergence reflects genuine uncertainty about the right framework — not indifference to the question.'),
  p('Independent and hybrid publishers face the same questions at a different scale. The ones building durable businesses are treating editorial standards as infrastructure, not overhead.'),

  h2('The Author\'s Responsibility in a Trust Economy'),
  p('Authors carry more of the trust burden than they may realize. In the AI era, a book is not just a book. It is a claim about the author\'s knowledge, judgment, and reliability. Readers who find that claim credible may follow an author for years — reading their next book, attending their talks, subscribing to their newsletter, recommending them to colleagues. Readers who find the claim unsupported by the content may never engage again.'),
  p('That calculus gives editorial integrity a commercial dimension that was less visible when the market was smaller. The Authors Guild\'s 2022 survey found that mean writing income for U.S. authors was $20,000, with only half of that from books. Senate testimony by novelist David Baldacci in July 2025 described author median income as having fallen 42% over the preceding decade. That context matters: authors who invest in the credibility of their published work are investing in the only asset they can build that compounds over time — their authority as a trustworthy voice in their field.'),
  p('The books that will define the next decade of publishing are not the ones produced most efficiently. They are the ones that earn and hold reader trust. Editorial integrity is not a nostalgic standard. It is the competitive advantage that matters most in a market where producing a book has become trivially easy.'),

  h2('Conclusion: Innovation and Integrity Are Not in Conflict'),
  p('Technology has changed every publishing cycle it has touched: the printing press, offset printing, desktop publishing, ebooks, and now generative AI. Each time, there were predictions about which traditional practices would not survive the change. Each time, the practices that survived were the ones tied to the irreducible core of what publishing is for: helping authors say what they mean, and helping readers trust what they read.'),
  p('AI is not an exception to that pattern. It is another instance of it. The tools keep changing. The standard stays the same: publish work that deserves to be read.'),

  h2('References'),
  p('Reimers, I., & Waldfogel, J. (2025). NBER Working Paper No. 34777.'),
  p('Bowker. (2026). U.S. ISBN statistics, 2025 annual data.'),
  p('Fortune Business Insights. (2025–2026). Global Generative AI Market data.'),
  p('Superlines. (2026, March). AI Search Statistics 2026: 60+ Data Points on Visibility, Citations, and Traffic.'),
  p('WriterCosmos. (2026, February 9). U.S. Publishing Rebalances in 2026 as Human Writers Regain Ground Amid AI Growth.'),
  p('Baldacci, D. (2025, July 16). Senate Judiciary Subcommittee testimony.'),
  p('ManuscriptReport. (2026, May). AI in Publishing: 2026 Statistics & Primary Sources.'),
  p('Jane Friedman. (2026, March 24). AI and Publishing: FAQ for Writers.'),
];
children.push(...art4);
children.push(new Paragraph({ children: [new PageBreak()] }));


// ═══════════════════════════════════════════════════════════════
// ARTICLE 5 — LinkedIn Article
// We Built a Publishing House Backwards. Here's Why That Was the Right Decision.
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(5, "We Built a Publishing House Backwards. Here's Why That Was the Right Decision.", 'LINKEDIN ARTICLE'));
children.push(
  meta('Format', 'LinkedIn Article (long-form, personal tone, strategic insight)'),
  meta('Objective', 'Positioning Axitos as a different kind of publisher, indirect authority claim'),
  meta('Tone', 'First-person practitioner, candid, no jargon'),
  divider(),
);

const art5 = [
  p('When we were designing what would become Axitos, someone asked a question that seemed obvious: "What kind of books do you want to publish?"'),
  p('We kept not being able to answer it cleanly. Not because we didn\'t have opinions about books, but because that question felt like it was starting from the wrong place.'),
  p('The question we kept returning to was different: "How do serious authors build durable authority in a world where AI systems increasingly mediate what gets found and what gets ignored?" If we could answer that question well, the publishing part was a means to an end. If we couldn\'t answer it, we were just another press adding titles to a market that already has more books than readers can absorb.'),
  p('That is not the way publishing companies are usually built. The standard model is: editorial standards first, then production, then marketing, then distribution, then — as an afterthought, usually after launch — something vague called "author platform." Discovery is the last chapter of the traditional playbook. It is treated as a promotional phase that happens after the book exists.'),
  p('We built it the other way around.'),

  h2('Why the Traditional Order Stopped Working'),
  p('The global self-publishing market reached $1.85 billion in 2024 and is projected to grow at a compound annual growth rate of 16.7% through 2033, according to market analysis published in 2026. Meanwhile, according to the same data, roughly 75% of self-published authors earn less than $1,000 per year. Those two figures coexist because volume and discoverability are not the same thing. The market is growing. Average author outcomes within that market are not.'),
  p('The challenge is not that books are being published badly. Many of them are produced competently. The challenge is that publication has become the beginning of a visibility problem, not the solution to it. According to data from Superlines (March 2026), approximately 93% of AI search sessions end without a traditional website click. Google AI Overviews reach 1.5 billion monthly users. ChatGPT has 810 million daily active users. When a reader asks any of these systems to recommend books on leadership, business resilience, or healthcare strategy, the system generates a list from its internal knowledge and retrieval architecture. Books that are not structured to be found, cited, and recommended by those systems simply do not appear.'),
  p('This is a structural problem with the traditional publishing sequence, not a marketing problem. By the time most publishers start thinking about discoverability, the book already exists in a form that was designed for human readers browsing catalogs — not for AI systems parsing entity authority and citation structure.'),

  h2('What Building It Backwards Actually Looks Like'),
  p('For Axitos, building backwards meant that every element of our publishing model was designed around a question: will this author and this book be discoverable, citable, and recommendable in five years?'),
  p('That required integrating what the GEO research describes as the technical and content foundations of AI discoverability directly into the publishing workflow. A Princeton-led team (Aggarwal et al., published in the Proceedings of the ACM KDD 2024 conference) tested how content structuring choices affect visibility across 10,000 real queries. Their findings were specific: adding concrete statistics increased AI visibility by up to 40%; adding quotations from credible sources lifted visibility by roughly 28%; adding in-text citations to primary sources more than doubled visibility for middle-ranked content. Those findings shaped how we help authors develop their supporting content ecosystems, not just how they write their books.'),
  p('Discoverability-first also meant integrating structured metadata from the beginning — ONIX 3.0, schema.org Book and Person markup, accurate BISAC subject classification, and consistent entity representation across all distribution channels. Book Industry Study Group guidance published in October 2025 made clear that the ONIX 3.0 transition was overdue and critical for machine readability. We made it standard from day one.'),
  p('It meant building citation tracking infrastructure so authors can actually measure whether their ideas are appearing in AI-generated answers — not just count sales or social media impressions. And it meant preparing the rights management framework that positions authors for AI citation royalties as that market matures.'),

  h2('The AI Citation Royalty Reality'),
  p('AI citation royalties are not theoretical. They are an emerging revenue stream with legal precedents already established. The settlement in Bartz v. Anthropic, described by the Authors Guild in April 2026, resulted in a $1.5 billion award covering approximately 500,000 books whose content was used in AI training without license, compensating authors at roughly $3,000 per book. Plaintiffs\' attorney Justin Nelson described it as the first landmark settlement of its kind — one that "sets a precedent requiring AI companies to pay copyright owners."'),
  p('Major AI companies have been entering licensing agreements with content owners across sectors. OpenAI announced deals with the Associated Press, the Financial Times (reported at $5–10 million annually by the Wall Street Journal), and Time Magazine. Wiley has described AI licensing as a meaningful component of its fiscal results. The Book Industry Study Group held webinars in late 2024 on AI content licensing frameworks. The infrastructure for compensating authors whose published work trains or informs AI systems is being built right now.'),
  p('Authors who are not positioned to participate in that infrastructure — because their rights are unclear, their work is not structured for citation, or their publisher has not thought about these questions — will not benefit from it. Authors whose publishing agreements include clear AI rights management, whose work is structured to be cited, and who have tracking systems in place to document citation events are positioned to benefit from a market that is still forming.'),

  h2('What Thought Leaders Actually Need from a Publisher'),
  p('The authors drawn to this model are not primarily interested in publishing a book. They are interested in what a book enables. Speaking engagements. Consulting authority. Category ownership in their field. Long-term visibility as a trusted source in a world where AI systems increasingly determine whose voice gets heard.'),
  p('For those authors, the relevant questions are not the traditional publishing questions. They are strategic questions: How does my book get found not just at launch but in three years? How do I become the entity that AI systems associate with my topic? How does publication support my authority in the AI-mediated information environment that now exists?'),
  p('A publisher who treats those questions as marketing afterthoughts cannot answer them. A publisher who builds their entire model around them can.'),
  p('That is the backwards-built publishing house. Discoverability is not a phase that comes after publication. It is the infrastructure that makes publication matter.'),

  h2('References'),
  p('Aggarwal, P., Murahari, V., Rajpurohit, T., Kalyan, A., Narasimhan, K., & Deshpande, A. (2024). GEO: Generative engine optimization. ACM KDD 2024.'),
  p('Authors Guild. (2026, April). What Authors Need to Know About the Anthropic Settlement.'),
  p('Superlines. (2026, March). AI Search Statistics 2026.'),
  p('Book Industry Study Group. (2025, October). Time to act: The ONIX 3 transition is actually here.'),
  p('Will Scott. (2025, October). How AI Licensing Deals Determine Search Visibility in 2025.'),
  p('ISBNDB Blog. (2026, May). Self-Publishing Is Changing the Book Industry.'),
  p('Automateed. (2026, May). Self-Publishing Statistics 2026.'),
];
children.push(...art5);
children.push(new Paragraph({ children: [new PageBreak()] }));


// ═══════════════════════════════════════════════════════════════
// ARTICLE 6 — Axitos Website
// The Author at the Threshold: Publishing, Power, and the AI Visibility Crisis
// ═══════════════════════════════════════════════════════════════

children.push(...sectionHeader(6, 'The Author at the Threshold: Publishing, Power, and the AI Visibility Crisis', 'AXITOS WEBSITE'));
children.push(
  meta('Meta Title', 'The Author at the Threshold: Publishing, Power, and the AI Visibility Crisis | Axitos'),
  meta('Meta Description', 'Over one million books are published every year. Most will never be found by the readers who need them. This is not a writing problem or a publishing problem. It is an AI visibility problem — and it is solvable.'),
  meta('Slug', '/author-at-the-threshold-publishing-power-ai-visibility-crisis'),
  meta('Target Keywords', 'AI book visibility, AI discoverability for authors, book publishing AI era, author authority AI, AI citation publishing 2026'),
  divider(),
);

const art6 = [
  h2('The Central Question Authors Are Not Asking — but Should Be'),
  p('The central challenge for serious authors in 2026 is not whether to publish. It is whether their published work will reach the readers who need it, or quietly disappear into a market producing more than a million new titles per year. According to Bowker data, U.S. book publications with ISBN numbers jumped 32.5% between 2024 and 2025 alone. The NBER working paper by Reimers and Waldfogel (2025, w34777) documented that the diffusion of large language models roughly tripled new book releases between 2022 and 2025. More books are being published than at any point in history. Fewer readers per book are finding each title.'),
  p('The question most authors ask is "how do I publish well?" The question that now determines outcomes is "how do I ensure that readers — and the AI systems that increasingly mediate what readers find — can actually locate my work?"'),

  h2('What the AI Visibility Crisis Actually Means for Authors'),
  p('AI-mediated discovery is now the dominant pathway through which readers encounter new books. According to Superlines research published in March 2026, Google AI Overviews reach 1.5 billion monthly users. ChatGPT has 810 million daily active users. Approximately 93% of AI search sessions end without a traditional website click. When someone opens Perplexity, ChatGPT, or Google AI Mode and asks "what should I read to understand organizational leadership in a crisis?" — that system generates a list from its training data and retrieval architecture. The list is short. Usually three to five titles. There is no page two.'),
  p('Books that are not present in those systems with clear, authoritative, machine-readable information do not appear on that list. They are invisible to the reader who would most benefit from them. This is the AI visibility crisis: a growing gap between the quality of published work and its findability in the systems that now mediate reading choices.'),
  p('A 2024 study presented at ACM KDD by Aggarwal and colleagues (GEO: Generative Engine Optimization) measured exactly how much this gap can be moved. Across 10,000 real queries tested on Perplexity AI, adding concrete statistics increased a page\'s visibility in AI answers by up to 40%. Adding quotations from credible sources lifted visibility by roughly 28%. Adding in-text citations to primary sources more than doubled AI visibility for content that was not already top-ranked. These are not marginal improvements. They are structural shifts in whether a body of work gets found.'),

  h2('The Major Players and What They Are — and Are Not — Offering'),
  p('Understanding where the industry currently stands requires looking honestly at what different categories of publishers and services are providing, and where the gaps remain.'),

  h3('Traditional Publishers (Big Five and Mid-Sized Houses)'),
  p('Penguin Random House, HarperCollins, Hachette, Simon & Schuster, and Macmillan collectively represent the highest brand authority in the industry. Their distribution reaches the broadest retailer network. Their editorial standards remain among the most rigorous available. What they do not offer is strategic AI visibility infrastructure. Their publishing workflows were designed for a world where discoverability meant placement on physical and digital shelves, review coverage, and word-of-mouth. Structured metadata for AI systems, Generative Engine Optimization, citation tracking, and AI royalty positioning are not standard components of their author services.'),
  p('For authors whose primary goal is prestige and the widest possible distribution network, traditional publishing remains compelling. For authors whose primary goal is building durable authority in AI-mediated environments, the traditional model offers the foundation but not the full structure.'),

  h3('Self-Publishing Platforms (Amazon KDP, IngramSpark, Draft2Digital, Reedsy)'),
  p('These platforms have democratized publishing in the most literal sense. Amazon KDP allows any author to publish a Kindle ebook in hours at no cost. IngramSpark provides print-on-demand access to global distribution networks at a fraction of traditional publishing costs. Draft2Digital offers aggregated distribution to multiple ebook retailers. Reedsy connects authors with vetted freelance editors, designers, and marketers.'),
  p('The self-publishing market reached $1.85 billion globally in 2024 and is projected to grow at 16.7% annually through 2033. But the income reality is stark: 75% of self-published authors earn less than $1,000 per year, while only the top 0.5% earn six figures. The platforms provide access; they do not provide positioning, AI visibility infrastructure, or rights management for an AI-citation economy. A self-published author is responsible for building every element of discoverability independently — which is possible, but requires expertise that most serious authors have not had occasion to develop.'),

  h3('Hybrid Publishing Companies (Greenleaf, Scribe Media, Lioncrest, Page Two)'),
  p('Hybrid publishers occupy the space between traditional and self-publishing. They provide professional editorial, design, and distribution services, typically for an author investment, while granting authors more control over rights and timelines than traditional contracts allow. Greenleaf Book Group, Scribe Media, Lioncrest Publishing, and Page Two are among the better-known players in this category. Their editorial quality is generally strong. Their distribution reaches major retail channels.'),
  p('What most current hybrid publishers do not integrate is AI visibility infrastructure as a standard publishing deliverable. Some offer marketing strategy as an add-on service. Structured metadata optimization for AI retrieval systems, GEO-aligned content development, citation tracking, and rights management for AI licensing are not, as of June 2026, standard components of their service model.'),

  h3('AI-Powered Writing and Self-Publishing Tools (Sudowrite, ProWritingAid, ManuscriptReport, AutoCrit)'),
  p('These tools serve the production layer of publishing. Sudowrite assists with drafting. ProWritingAid and AutoCrit assist with editorial polish. ManuscriptReport generates marketing materials from a manuscript upload. They are genuinely useful for specific, narrow tasks.'),
  p('None of them are publishing companies. They provide no editorial relationship, no distribution infrastructure, no rights management, and no long-horizon authority-building strategy. An author using these tools still faces the full responsibility of discoverability, distribution, and positioning independently.'),

  h2('What No Other Publisher Is Currently Offering — and Why It Matters'),
  p('The service gap in the current publishing landscape is specific and significant. Authors who want professional publishing — genuine editorial work, professional design, global distribution, royalty income, and a meaningful rights framework — must currently choose between traditional publishers (who provide most of this but not AI visibility infrastructure) or hybrid publishers (who provide most of this but also not AI visibility infrastructure).'),
  p('Axitos was built to close that gap. As described in the company\'s June 2026 launch announcement, its model integrates professional book publishing with Generative Engine Optimization (GEO), Answer Engine Optimization (AEO), structured metadata for AI retrieval systems, citation tracking, and AI citation royalty registration as standard components of the publishing workflow for each accepted author. This is not offered as an add-on or a premium tier. It is built into the publishing model because the company\'s position is that a serious book in 2026 cannot be professionally published without it.'),
  p('The combination — editorial quality, professional production, global distribution, and AI visibility infrastructure in a single publishing relationship — does not currently exist elsewhere in the hybrid or independent publishing market. That is not a promotional claim. It is a description of a specific gap in a specific market, and a statement about where Axitos has chosen to operate.'),

  h2('What the AI Citation Royalty Market Means for Authors Right Now'),
  p('The emerging AI citation royalty market deserves careful attention from any author considering their publishing strategy over the next decade.'),
  p('The legal framework is already forming. The Bartz v. Anthropic settlement, announced in October 2025 and described by the Authors Guild in April 2026, established that AI companies must pay copyright owners when their books are used for training. The settlement covers approximately 500,000 books and compensates authors at roughly $3,000 per book, with payments extending through 2027. Plaintiffs\' attorney Justin Nelson described it as setting a precedent that "AI companies must pay copyright owners."'),
  p('Parallel licensing frameworks are developing across the industry. OpenAI has entered agreements with the Associated Press, the Financial Times, and Time Magazine. Wiley reported AI licensing as a growth component of its fiscal 2025 results. The Book Industry Study Group organized industry conversations in 2024 on content licensing frameworks for AI, recognizing that publishers and rights holders need structured approaches to these agreements.'),
  p('The estimated rate for individual books in early AI licensing arrangements has been reported at approximately $3,000 per title for training use, with five books at that rate netting roughly $12,750 after a typical 15% platform fee. Those figures will change as the market develops. The direction of change — toward more structured, compensated AI use of published works — appears established.'),
  p('Authors whose publishing arrangements include clear AI rights management, whose work is structured to be cited, and whose citation events are tracked are positioned to participate in that market. Authors whose arrangements do not include these components are not.'),

  h2('What Practical AI Visibility Means: A Framework for Authors'),
  p('Whether you are working with a publisher or navigating the publishing landscape independently, the following framework reflects the current state of evidence on what determines AI visibility.'),
  p('Technical eligibility comes first. Your content must be reachable by retrieval bots — the automated systems that feed real-time information to ChatGPT, Perplexity, Claude, and Google AI. Google\'s documentation specifies that pages must be indexed and eligible for standard search snippets to appear in AI Overviews. Blocking AI crawlers guarantees AI invisibility, regardless of content quality.'),
  p('Structured metadata is the next layer. ONIX 3.0 records with specific BISAC subject codes, schema.org Book and Person markup on your web presence, and consistent entity representation across distribution channels allow AI systems to correctly identify who you are and what your book is about. The Book Industry Study Group\'s October 2025 guidance described the ONIX 3 transition as overdue and critical.'),
  p('Content structure determines citability. The GEO research by Aggarwal and colleagues found that leading with a direct answer, using concrete statistics rather than vague claims, citing credible primary sources in-text, and organizing content around the questions readers actually ask are the highest-impact moves an author can make for AI visibility. These are also the moves that make content more useful to human readers. AI visibility and genuine usefulness to readers are not in tension — they are, in this regard, the same thing.'),
  p('External authority signals anchor the whole structure. Library holdings in WorldCat, coverage in respected trade publications, scholarly citations where your work warrants them, and Wikipedia representation where notability thresholds are met — these create the ecosystem of third-party recognition that AI systems use to assess whether an author is a trusted source on their topic.'),

  h2('The Ten-Year Projection: What Serious Authors Should Expect'),
  p('Looking forward to 2036, the trajectory is not ambiguous. AI-mediated discovery will account for an increasing share of reader book discovery. The authors who build entity authority, structured AI visibility, and rights management infrastructure in 2026 and 2027 will occupy established positions in AI knowledge graphs by the time that market reaches full maturity. The authors who delay will be building from scratch in a market where the early positions are already taken.'),
  p('The good news, supported by the GEO research, is that AI discoverability advantages flow disproportionately to authors who are earlier in their authority-building trajectory. The strategies that improve AI visibility most dramatically are precisely the ones where content quality and genuine expertise have not yet been recognized by the system — which means the authors who most need the help are the ones who benefit most from applying the research. Writing with factual density, transparent sourcing, and a clear structure is not a technique for gaming AI. It is the same discipline that makes books worth reading in the first place.'),
  p('Publishing, properly done, has always been about connecting ideas with the people who need them. That mission has not changed. The systems that mediate those connections have. The authors who understand both things — the permanence of the mission and the changed mechanics of discovery — are the ones positioned to build something that lasts.'),

  h2('References'),
  p('Aggarwal, P., Murahari, V., Rajpurohit, T., Kalyan, A., Narasimhan, K., & Deshpande, A. (2024). GEO: Generative engine optimization. ACM KDD 2024. https://doi.org/10.1145/3637528.3671900'),
  p('Reimers, I., & Waldfogel, J. (2025). NBER Working Paper No. 34777.'),
  p('Bowker. (2026). U.S. ISBN statistics, 2025 annual data.'),
  p('Superlines. (2026, March). AI Search Statistics 2026.'),
  p('Authors Guild. (2026, April). What Authors Need to Know About the Anthropic Settlement.'),
  p('Will Scott. (2025, October). How AI Licensing Deals Determine Search Visibility in 2025.'),
  p('Book Industry Study Group. (2025, October). Time to act: The ONIX 3 transition is actually here.'),
  p('Google. (2026, June). Introducing Search Generative AI performance reports in Search Console.'),
  p('Automateed. (2026). Self-Publishing Statistics 2026.'),
  p('Fortune Business Insights. (2026). Global Generative AI Market, 2026 projection.'),
  p('Axitos Publishing House. (2026, June 2). Axitos.ai Launches Hybrid Book Publishing, AI Visibility, and AI Citation Monetization Under One Roof.'),
  p('Axitos Publishing House. (2026, June 8). Axitos Publishing House Launches Traditional Publishing Model.'),

  ...schemaBox('JSON-LD Schema (WebPage + FAQPage — for Axitos website)',
`{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.axitos.ai/author-at-the-threshold-publishing-power-ai-visibility-crisis",
      "name": "The Author at the Threshold: Publishing, Power, and the AI Visibility Crisis",
      "description": "Over one million books published annually. Most invisible to AI. A research-grounded analysis of the AI visibility crisis and what authors can do about it.",
      "author": { "@type": "Person", "name": "Francis E. Umesiri" },
      "publisher": { "@type": "Organization", "name": "Axitos Publishing House", "url": "https://www.axitos.ai" },
      "datePublished": "2026-06-11",
      "mainEntity": { "@id": "#faq" }
    },
    {
      "@type": "FAQPage",
      "@id": "#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the AI visibility crisis for authors?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The AI visibility crisis is the growing gap between the quality of published work and its findability in AI-mediated discovery systems. As 93% of AI search sessions end without a traditional website click, books not structured for AI citation and recommendation are effectively invisible to the readers who need them."
          }
        },
        {
          "@type": "Question",
          "name": "How can authors improve their AI discoverability in 2026?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Authors improve AI discoverability through five layers: (1) technical eligibility — ensuring retrieval bots can access their content; (2) structured metadata — ONIX 3.0, schema.org Book markup; (3) GEO-aligned content — statistics, citations, question-driven structure; (4) external authority signals — library holdings, reputable coverage; (5) citation tracking — measuring AI visibility over time."
          }
        },
        {
          "@type": "Question",
          "name": "What are AI citation royalties and how do authors qualify?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AI citation royalties compensate authors when their published work is used to train or inform AI systems. The Bartz v. Anthropic settlement (2025) established approximately $3,000 per book as a benchmark. Authors qualify by having clear AI rights provisions in their publishing agreements and by registering works through relevant licensing channels."
          }
        },
        {
          "@type": "Question",
          "name": "What does Axitos Publishing House offer that other publishers do not?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Axitos integrates professional book publishing with Generative Engine Optimization (GEO), Answer Engine Optimization (AEO), AI citation tracking, and AI citation royalty registration as standard components of its publishing workflow — combining services that no other hybrid or traditional publisher currently bundles in a single publishing relationship."
          }
        }
      ]
    }
  ]
}`),
];
children.push(...art6);
children.push(new Paragraph({ children: [new PageBreak()] }));

// ── APPENDIX: Notes on Platform Optimisation ──
children.push(
  divider(),
  h1('Platform Optimization Notes'),
  h2('Article 1 & 6 — Axitos Website'),
  p('Use the provided JSON-LD schemas verbatim in the <head> section of each page. Internal links should connect: Article 1 → Article 6 → /generative-engine-optimization-for-books-the-complete-2026-guide → /axitos-ai-launches-hybrid-book-publishing-ai-visibility-and-ai-citation-monetization-under-one-roof → /ai-citation-royalties-the-income-stream-most-authors-dont-know-exists. External links: cite the Aggarwal et al. 2024 ACM paper (arxiv.org/abs/2311.09735), the NBER w34777 paper (nber.org), and BISG metadata guidelines (bisg.org).'),
  h2('Article 2 — LinkedIn (Post format)'),
  p('Post directly as a LinkedIn text post. No external links in the body (reduces LinkedIn reach). Include a link to the Axitos website as the first comment. Use the hashtags exactly as written at the end of the post. Best posting time: Tuesday or Wednesday, 9–11am local time. Engage with every comment within the first hour.'),
  h2('Article 3 — Substack'),
  p('Publish as a paid or free post in the Axitos or author newsletter. Add a short 1-paragraph introduction contextualizing the piece for subscribers. The references section should hyperlink to each cited source. Add a brief author bio section at the end linking back to axitos.ai.'),
  h2('Article 4 — Medium'),
  p('Publish under the author\'s personal Medium profile or the Axitos publication. Add the canonical URL in Medium\'s SEO settings pointing to the Axitos website version if cross-published. Tags: Publishing, Artificial Intelligence, Books, Editorial, Writing. The byline should read: Francis E. Umesiri | Axitos Publishing House.'),
  h2('Article 5 — LinkedIn Article (Long-form)'),
  p('Publish as a LinkedIn Article (not a post). Use H2 headers exactly as written. LinkedIn Articles are indexed by Google and can appear in search results — the references section at the end adds SEO authority. Include a call-to-action at the end: "If you are building authority through a book, we are accepting queries at axitos.ai/submit-manuscript."'),
);

// ─── BUILD DOCUMENT ───────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 24 } }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 40, bold: true, font: 'Arial', color: '111111' },
        paragraph: { spacing: { before: 480, after: 120 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: '222222' },
        paragraph: { spacing: { before: 360, after: 100 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '333333' },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 2 }
      },
    ]
  },
  numbering: { config: [] },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children
  }]
});

const OUT_PATHS = [
  '/mnt/user-data/outputs/Axitos_Six_Articles_FrancisUmesiri_June2026.docx',
  __dirname + '/../Axitos_Six_Articles_FrancisUmesiri_June2026.docx'
];

Packer.toBuffer(doc).then(buffer => {
  for (const out of OUT_PATHS) {
    try {
      fs.writeFileSync(out, buffer);
      console.log('Wrote:', out, '(' + buffer.length + ' bytes)');
    } catch (e) {
      console.error('Could not write', out, '-', e.message);
    }
  }
  console.log('Done. File written.');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
