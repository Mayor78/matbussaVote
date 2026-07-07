// src/scripts/Preload.js
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const students = [
  {
    matric_number: '2025/MTBM/HND/317',
    full_name: 'Abraham Mayowa Shubomi',
    level: 'HND1',
    registered_status: false,
    voting_status: false,
    created_at: new Date().toISOString()
  },
 
];

export const Preload = async () => {
  let added = 0;
  let skipped = 0;
  
  for (const student of students) {
    try {
      // Check if student already exists
      const studentsQuery = query(
        collection(db, 'students'),
        where('matric_number', '==', student.matric_number)
      );
      const existingSnapshot = await getDocs(studentsQuery);
      
      if (existingSnapshot.empty) {
        await addDoc(collection(db, 'students'), student);
        console.log(`✅ Added: ${student.full_name} (${student.matric_number})`);
        added++;
      } else {
        console.log(`⏭️ Skipped: ${student.full_name} already exists`);
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Error adding ${student.full_name}:`, error);
    }
  }
  
  console.log(`\n📊 Summary: ${added} added, ${skipped} skipped, ${students.length} total`);
  return { added, skipped, total: students.length };
};

// Run this function
Preload().then(() => console.log('Preload complete!'));