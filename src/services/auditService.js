import { db, auth } from '../lib/firebase';
import { 
  collection, addDoc, getDocs, query, orderBy, 
  limit, startAfter, where
} from 'firebase/firestore';

export const auditService = {
  async logAction({ action, details }) {
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'auditLogs'), {
        action,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        details: details || '',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  },

  async getAuditLogs({ pageSize = 50, lastVisible = null, actionFilter = '' } = {}) {
    try {
      let q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(pageSize)
      );

      if (lastVisible) {
        q = query(
          collection(db, 'auditLogs'),
          orderBy('timestamp', 'desc'),
          startAfter(lastVisible),
          limit(pageSize)
        );
      }

      if (actionFilter) {
        q = query(
          collection(db, 'auditLogs'),
          where('action', '==', actionFilter),
          orderBy('timestamp', 'desc'),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

      return { logs, lastVisible: lastDoc, hasMore: snapshot.docs.length === pageSize };
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return { logs: [], lastVisible: null, hasMore: false };
    }
  },

  async getActionCounts() {
    try {
      const snapshot = await getDocs(collection(db, 'auditLogs'));
      const counts = {};
      snapshot.docs.forEach(doc => {
        const action = doc.data().action;
        counts[action] = (counts[action] || 0) + 1;
      });
      return counts;
    } catch (error) {
      console.error('Error fetching action counts:', error);
      return {};
    }
  },
};
