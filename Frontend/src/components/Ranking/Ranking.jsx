import React, { useEffect, useState } from "react";
import "./Ranking.css"; // Style it nicely

const Ranking = () => {
  const [rankingData, setRankingData] = useState([]);

  useEffect(() => {
    // Simulated fetch; replace this with your actual API call
    const fetchRanking = async () => {
      const fakeData = [
        { username: "Alice", score: 95 },
        { username: "Bob", score: 87 },
        { username: "Charlie", score: 82 },
      ];
      setRankingData(fakeData);
    };

    fetchRanking();
  }, []);

  return (
    <div className="ranking-container">
      <h2>🏆 Top Rankings</h2>
      <ul>
        {rankingData.map((user, index) => (
          <li key={index} className="ranking-item">
            <span className="rank">#{index + 1}</span>
            <span className="name">{user.username}</span>
            <span className="score">{user.score} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Ranking;
