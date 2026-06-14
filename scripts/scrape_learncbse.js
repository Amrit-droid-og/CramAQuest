import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target index sources on learncbse.in
const INDEX_SOURCES = [
  { classGrade: "12", subject: "Physics", url: "https://www.learncbse.in/physics-mcqs-for-class-12-chapter-wise-with-answers/" },
  { classGrade: "12", subject: "Chemistry", url: "https://www.learncbse.in/chemistry-mcqs-for-class-12-chapter-wise-with-answers/" },
  { classGrade: "12", subject: "Biology", url: "https://www.learncbse.in/biology-mcqs-for-class-12-chapter-wise-with-answers/" },
  { classGrade: "12", subject: "Mathematics", url: "https://www.learncbse.in/maths-mcqs-for-class-12-chapter-wise-with-answers/" },
  { classGrade: "11", subject: "Physics", url: "https://www.learncbse.in/physics-mcqs-for-class-11-chapter-wise-with-answers/" },
  { classGrade: "11", subject: "Chemistry", url: "https://www.learncbse.in/chemistry-mcqs-for-class-11-chapter-wise-with-answers/" },
  { classGrade: "11", subject: "Biology", url: "https://www.learncbse.in/biology-mcqs-for-class-11-chapter-wise-with-answers/" },
  { classGrade: "11", subject: "Mathematics", url: "https://www.learncbse.in/maths-mcqs-for-class-11-chapter-wise-with-answers/" },
  { classGrade: "10", subject: "Science", url: "https://www.learncbse.in/mcq-questions-for-class-10-science-with-answers/" },
  { classGrade: "10", subject: "Mathematics", url: "https://www.learncbse.in/mcq-questions-for-class-10-maths-with-answers/" },
  { classGrade: "9", subject: "Science", url: "https://www.learncbse.in/class-9-science-mcq/" },
  { classGrade: "9", subject: "Mathematics", url: "https://www.learncbse.in/class-9-maths-mcq/" },
  { classGrade: "8", subject: "Science", url: "https://www.learncbse.in/class-8-science-mcq/" },
  { classGrade: "8", subject: "Mathematics", url: "https://www.learncbse.in/class-8-maths-mcq/" },
  { classGrade: "7", subject: "Science", url: "https://www.learncbse.in/class-7-science-mcq/" },
  { classGrade: "7", subject: "Mathematics", url: "https://www.learncbse.in/class-7-maths-mcq/" },
  { classGrade: "6", subject: "Science", url: "https://www.learncbse.in/class-6-science-mcq/" },
  { classGrade: "6", subject: "Mathematics", url: "https://www.learncbse.in/class-6-maths-mcq/" }
];

// Helper to delay requests and avoid getting blocked
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Classify CBSE general Science/SST chapters into granular CramAQuest subjects
function classifySubject(chapterTitle, defaultSubject) {
  const title = chapterTitle.toLowerCase();
  
  if (defaultSubject === "Mathematics") {
    return "Mathematics";
  }

  // Chemistry keywords
  if (
    title.includes("chemical") || title.includes("acid") || title.includes("base") || 
    title.includes("salt") || title.includes("metal") || title.includes("carbon") || 
    title.includes("periodic") || title.includes("matter") || title.includes("atom") || 
    title.includes("molecule") || title.includes("substance") || title.includes("combustion") ||
    title.includes("coal") || title.includes("petroleum") || title.includes("synthetic") ||
    title.includes("fibre") || title.includes("plastic") || title.includes("chemistry")
  ) {
    return "Chemistry";
  }

  // Biology keywords
  if (
    title.includes("life") || title.includes("reproduce") || title.includes("heredity") || 
    title.includes("evolution") || title.includes("cell") || title.includes("tissue") || 
    title.includes("organism") || title.includes("disease") || title.includes("health") || 
    title.includes("food") || title.includes("living") || title.includes("crop") || 
    title.includes("biodiversity") || title.includes("conservation") || title.includes("plant") || 
    title.includes("animal") || title.includes("microorganism") || title.includes("nutrition") ||
    title.includes("respiration") || title.includes("transportation") || title.includes("excretion") ||
    title.includes("biology")
  ) {
    return "Biology";
  }

  // Physics keywords
  if (
    title.includes("light") || title.includes("eye") || title.includes("electricity") || 
    title.includes("magnetic") || title.includes("motion") || title.includes("force") || 
    title.includes("gravitation") || title.includes("work") || title.includes("energy") || 
    title.includes("sound") || title.includes("friction") || title.includes("heat") || 
    title.includes("pressure") || title.includes("wind") || title.includes("storm") || 
    title.includes("cyclone") || title.includes("star") || title.includes("solar") ||
    title.includes("physics") || title.includes("measurement") || title.includes("lightning")
  ) {
    return "Physics";
  }

  // History keywords
  if (
    title.includes("history") || title.includes("french") || title.includes("russian") || 
    title.includes("nazism") || title.includes("pastoralist") || title.includes("nationalism") || 
    title.includes("empire") || title.includes("india") || title.includes("king") || 
    title.includes("ruler") || title.includes("trade") || title.includes("rebellion") || 
    title.includes("industrialisation") || title.includes("print") || title.includes("culture")
  ) {
    return "History";
  }

  // Geography keywords
  if (
    title.includes("geography") || title.includes("resource") || title.includes("forest") || 
    title.includes("water") || title.includes("agriculture") || title.includes("mineral") || 
    title.includes("manufacturing") || title.includes("climate") || title.includes("vegetation") || 
    title.includes("population") || title.includes("earth") || title.includes("map") || 
    title.includes("soil") || title.includes("wildlife") || title.includes("globe") ||
    title.includes("solar system") || title.includes("environment") || title.includes("disaster")
  ) {
    return "Geography";
  }

  // Fallback map
  if (defaultSubject === "Science") {
    // Distribute evenly if no keywords match
    const hash = chapterTitle.length % 3;
    return hash === 0 ? "Physics" : hash === 1 ? "Chemistry" : "Biology";
  }

  return defaultSubject;
}

// Extract links from index page
async function fetchChapterLinks(source) {
  try {
    console.log(`Fetching index page for Class ${source.classGrade} ${source.subject}: ${source.url}`);
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const links = [];
    
    // Find all links in the main content area
    $('.entry-content a').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      
      if (!href) return;
      
      // Normalize absolute/relative links
      const absoluteUrl = href.startsWith('http') ? href : `https://www.learncbse.in${href.startsWith('/') ? '' : '/'}${href}`;
      
      // Skip indexing the index source page itself
      if (absoluteUrl === source.url || absoluteUrl === `${source.url}/`) {
        return;
      }

      // Check if URL belongs to the target class and contains 'mcq'
      const matchesClass = absoluteUrl.includes(`class-${source.classGrade}`) || 
                           absoluteUrl.includes(`class${source.classGrade}`) ||
                           absoluteUrl.includes(`class-grade-${source.classGrade}`) ||
                           absoluteUrl.includes(`class-level-${source.classGrade}`);
                           
      const isMcqUrl = matchesClass && absoluteUrl.toLowerCase().includes('mcq');
      
      if (isMcqUrl) {
        if (!links.some(l => l.url === absoluteUrl)) {
          links.push({
            title: title || href.split('/').filter(Boolean).pop(),
            url: absoluteUrl
          });
        }
      }
    });
    
    console.log(`Found ${links.length} chapter links for Class ${source.classGrade} ${source.subject}`);
    return links;
  } catch (err) {
    console.error(`Error fetching index page ${source.url}:`, err.message);
    return [];
  }
}

// Parse MCQ questions from a chapter page
async function scrapeChapterPage(chapter, source) {
  try {
    console.log(`Scraping chapter: "${chapter.title}" from ${chapter.url}...`);
    const response = await axios.get(chapter.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const questions = [];
    
    // Select all <details> elements which contain the answers
    $('details').each((idx, detailsEl) => {
      try {
        const detailsText = $(detailsEl).text().trim();
        const summaryText = $(detailsEl).find('summary').text().trim();
        
        // Remove summary text from details content
        const contentText = detailsText.replace(summaryText, '').trim();
        
        // Extract correct option ID (a, b, c, or d)
        // Check for formats like "Answer: d" or "Answer: (d)" or "Answer: d\n"
        const answerMatch = contentText.match(/Answer:\s*\(?([a-d])\)?/i);
        if (!answerMatch) return;
        const correctOptionId = answerMatch[1].toLowerCase();
        
        // Extract explanation/learningContext
        let learningContext = "";
        const explanationMatch = contentText.match(/(?:Explanation|Explaination|Reason):\s*([\s\S]+)/i);
        if (explanationMatch) {
          learningContext = explanationMatch[1].trim();
        } else {
          learningContext = contentText.replace(/Answer:\s*\(?[a-d]\)?/i, '').trim();
        }
        learningContext = learningContext.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Find preceding paragraphs for question and options
        let sibling = $(detailsEl).prev();
        let textBlocks = [];
        
        // Look up to 4 elements backward to find a block containing options like (a), (b), etc.
        for (let i = 0; i < 4 && sibling.length > 0; i++) {
          const text = sibling.text().trim();
          if (text) {
            textBlocks.unshift(text);
          }
          if (text.match(/\([a-d]\)/i) || text.match(/[a-d]\.\s+/i)) {
            break; // Found options block
          }
          sibling = sibling.prev();
        }
        
        if (textBlocks.length === 0) return;
        
        const combinedText = textBlocks.join('\n');
        
        // Split options based on delimiters
        const delimiters = [
          /\r?\n\([a-d]\)\s+/i, // Newline + (a)
          /\s+\([a-d]\)\s+/i,    // Space + (a)
          /\([a-d]\)/i,          // Just (a)
          /\r?\n[a-d]\.\s+/i,    // Newline + a.
          /\s+[a-d]\.\s+/i       // Space + a.
        ];
        
        let parts = null;
        for (const delim of delimiters) {
          const testParts = combinedText.split(delim);
          if (testParts.length >= 5) {
            parts = testParts;
            break;
          }
        }
        
        if (!parts) return;
        
        let questionText = parts[0].trim();
        // Strip question number from the start (e.g. "1. What is..." or "12. ")
        questionText = questionText.replace(/^\d+[\.\s\-)]+/, '').trim();
        questionText = questionText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        const options = [
          { id: 'a', text: parts[1].replace(/[\r\n\t]+/g, ' ').trim() },
          { id: 'b', text: parts[2].replace(/[\r\n\t]+/g, ' ').trim() },
          { id: 'c', text: parts[3].replace(/[\r\n\t]+/g, ' ').trim() },
          { id: 'd', text: parts[4].replace(/[\r\n\t]+/g, ' ').trim() }
        ];
        
        // Exclude questions with empty option text
        if (options.some(o => !o.text)) return;
        
        // Create unique question ID
        const cleanTitleSlug = chapter.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20);
        const questionId = `scraped-${source.classGrade}-${cleanTitleSlug}-${idx}`;
        
        questions.push({
          id: questionId,
          questionText,
          options,
          correctOptionId,
          xpValue: 20,
          learningContext: learningContext || `Option ${correctOptionId.toUpperCase()} is the correct answer.`
        });
      } catch (innerErr) {
        // Skip malformed questions
      }
    });
    
    console.log(`Parsed ${questions.length} questions from "${chapter.title}"`);
    return questions;
  } catch (err) {
    console.error(`Error scraping chapter page ${chapter.url}:`, err.message);
    return [];
  }
}

// Main execution function
async function main() {
  const outputData = {};
  
  // Initialize structured data layout
  for (let grade = 6; grade <= 12; grade++) {
    outputData[grade.toString()] = {
      "Mathematics": [],
      "Physics": [],
      "Chemistry": [],
      "Biology": [],
      "History": [],
      "Geography": []
    };
  }

  let totalQuestionsCount = 0;

  for (const source of INDEX_SOURCES) {
    const chapterLinks = await fetchChapterLinks(source);
    
    // We scrape a max of 12 chapters per index source to cover standard chapters
    const chaptersToScrape = chapterLinks.slice(0, 12); 
    
    for (const chapter of chaptersToScrape) {
      // Pause to be gentle to the web server
      await delay(1200);
      
      const questions = await scrapeChapterPage(chapter, source);
      if (questions.length === 0) continue;
      
      // Classify the chapter's questions into target CramAQuest subjects
      const targetSubject = classifySubject(chapter.title, source.subject);
      
      const grade = source.classGrade;
      if (outputData[grade] && outputData[grade][targetSubject]) {
        // Avoid duplicate questions by checking text
        const currentList = outputData[grade][targetSubject];
        for (const q of questions) {
          if (!currentList.some(cq => cq.questionText === q.questionText)) {
            currentList.push(q);
            totalQuestionsCount++;
          }
        }
        console.log(`Class ${grade} ${targetSubject} current total: ${outputData[grade][targetSubject].length} questions. Global total: ${totalQuestionsCount}`);
      }
    }
  }

  // Ensure output directory exists
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  // Write result to local JSON file
  const outputPath = path.join(dataDir, 'scraped_questions.json');
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
  
  console.log(`\n==================================================`);
  console.log(`SUCCESS! Successfully scraped ${totalQuestionsCount} unique questions!`);
  console.log(`Data saved to: ${outputPath}`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("Fatal scraper error:", err);
});
