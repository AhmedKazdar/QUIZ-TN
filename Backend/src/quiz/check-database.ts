import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuizService } from './quiz.service';

async function checkAndSeedDatabase() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const quizService = app.get(QuizService);

  try {
    console.log('🔍 Checking existing questions in database...');
    const allQuestions = await quizService.getAllQuestions();
    console.log(`📊 Found ${allQuestions.length} questions in database`);

    if (allQuestions.length > 0) {
      console.log('✅ Questions already exist in database!');
      console.log('Sample questions:');
      allQuestions.slice(0, 3).forEach((q, i) => {
        console.log(`${i + 1}. ${q.question.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ No questions found. Adding sample questions...');

      const sampleQuestions = [
        {
          question: "What is the capital of France?",
          options: [
            { text: "London", isCorrect: false },
            { text: "Berlin", isCorrect: false },
            { text: "Paris", isCorrect: true },
            { text: "Madrid", isCorrect: false }
          ]
        },
        {
          question: "Which planet is known as the Red Planet?",
          options: [
            { text: "Venus", isCorrect: false },
            { text: "Mars", isCorrect: true },
            { text: "Jupiter", isCorrect: false },
            { text: "Saturn", isCorrect: false }
          ]
        },
        {
          question: "What is 2 + 2?",
          options: [
            { text: "3", isCorrect: false },
            { text: "4", isCorrect: true },
            { text: "5", isCorrect: false },
            { text: "6", isCorrect: false }
          ]
        },
        {
          question: "Who painted the Mona Lisa?",
          options: [
            { text: "Vincent van Gogh", isCorrect: false },
            { text: "Pablo Picasso", isCorrect: false },
            { text: "Leonardo da Vinci", isCorrect: true },
            { text: "Michelangelo", isCorrect: false }
          ]
        },
        {
          question: "What is the largest mammal in the world?",
          options: [
            { text: "African Elephant", isCorrect: false },
            { text: "Blue Whale", isCorrect: true },
            { text: "Giraffe", isCorrect: false },
            { text: "Polar Bear", isCorrect: false }
          ]
        }
      ];

      for (const q of sampleQuestions) {
        await quizService.create(q);
        console.log(`✅ Added: ${q.question}`);
      }

      console.log('🎉 Sample questions added successfully!');
    }

    // Verify the questions work
    console.log('\n🧪 Testing question retrieval...');
    const testQuestions = await quizService.getRandomQuestions(3);
    console.log(`✅ Successfully retrieved ${testQuestions.length} random questions`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await app.close();
  }
}

checkAndSeedDatabase();
