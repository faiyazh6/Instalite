// package server.ranking;

// import com.fasterxml.jackson.databind.ObjectMapper;
// import com.fasterxml.jackson.core.type.TypeReference;
// import scala.Tuple2;

// import java.io.BufferedReader;
// import java.io.FileReader;
// import java.io.IOException;
// import java.sql.*;
// import java.util.*;
// import java.util.Properties;

// import org.apache.spark.api.java.JavaPairRDD;

// public class DBUtils {

//     public static Properties loadDBCredentialsFromEnv(String envPath) throws IOException {
//         Properties props = new Properties();
//         BufferedReader reader = new BufferedReader(new FileReader(envPath));
//         String line;
//         while ((line = reader.readLine()) != null) {
//             if (line.contains("=")) {
//                 String[] parts = line.split("=", 2);
//                 String key = parts[0].trim();
//                 String value = parts[1].trim();
//                 if (key.equals("DATABASE_SERVER")) props.setProperty("host", value);
//                 else if (key.equals("DATABASE_NAME")) props.setProperty("db", value);
//                 else if (key.equals("DATABASE_USER")) props.setProperty("user", value);
//                 else if (key.equals("DATABASE_PASSWORD")) props.setProperty("password", value);
//             }
//         }
//         reader.close();
//         return props;
//     }

//     private static Connection getConnection() throws SQLException, IOException {
//         Properties dbProps = loadDBCredentialsFromEnv(".env");

//         String host = dbProps.getProperty("host");
//         String db = dbProps.getProperty("db");
//         String user = dbProps.getProperty("user");
//         String password = dbProps.getProperty("password");

//         try {
//             Class.forName("com.mysql.cj.jdbc.Driver");
//         } catch (ClassNotFoundException e) {
//             throw new RuntimeException("MySQL JDBC driver not found in classpath!", e);
//         }
//         return DriverManager.getConnection(
//             "jdbc:mysql://" + host + ":3306/" + db, user, password
//         );
//     }

//     public static List<Tuple2<Integer, Integer>> getUserLikes() {
//         List<Tuple2<Integer, Integer>> likes = new ArrayList<>();

//         try (Connection conn = getConnection()) {
//             String sql = "SELECT user_id, post_id FROM post_likes";
//             try (Statement stmt = conn.createStatement();
//                  ResultSet rs = stmt.executeQuery(sql)) {

//                 int count = 0;
//                 while (rs.next()) {
//                     int userId = rs.getInt("user_id");
//                     int postId = rs.getInt("post_id");
//                     likes.add(new Tuple2<>(userId, postId));
//                     count++;
//                 }
//                 System.out.println("DEBUG: Loaded " + count + " post likes from database");
//             }
//         } catch (SQLException | IOException e) {
//             System.err.println("ERROR in getUserLikes: " + e.getMessage());
//             e.printStackTrace();
//         }

//         return likes;
//     }

//     public static List<Tuple2<Integer, Integer>> getFriendEdges() {
//         List<Tuple2<Integer, Integer>> friends = new ArrayList<>();

//         try (Connection conn = getConnection()) {
//             String sql = "SELECT follower, following FROM friends";
//             try (Statement stmt = conn.createStatement();
//                  ResultSet rs = stmt.executeQuery(sql)) {

//                 int count = 0;
//                 while (rs.next()) {
//                     int follower = rs.getInt("follower");
//                     int following = rs.getInt("following");
//                     friends.add(new Tuple2<>(follower, following));
//                     count++;
//                 }
//                 System.out.println("DEBUG: Loaded " + count + " friendship connections from database");
//             }
//         } catch (SQLException | IOException e) {
//             System.err.println("ERROR in getFriendEdges: " + e.getMessage());
//             e.printStackTrace();
//         }

//         return friends;
//     }

//     public static void writeRankedPostsToMySQL(JavaPairRDD<String, Map<Integer, Double>> labelVectors) {
//         try (Connection conn = getConnection()) {
//             try (Statement stmt = conn.createStatement()) {
//                 stmt.executeUpdate("TRUNCATE TABLE ranked_feed");
//                 System.out.println("DEBUG: Cleared existing ranked_feed table");
//             }
//         } catch (SQLException | IOException e) {
//             System.err.println("ERROR clearing ranked_feed table: " + e.getMessage());
//             e.printStackTrace();
//         }

//         // Filter to only post nodes
//         JavaPairRDD<String, Map<Integer, Double>> postNodes = labelVectors.filter(record -> record._1.startsWith("p"));
//         long postNodeCount = postNodes.count();
//         System.out.println("DEBUG: Found " + postNodeCount + " post nodes to process for ranked feed");

//         if (postNodeCount == 0) {
//             System.out.println("WARNING: No post nodes found in label vectors! Check graph construction.");
//             return;
//         }

//         // Batch insert with foreachPartition
//         postNodes.foreachPartition(iterator -> {
//             try (Connection conn = getConnection()) {
//                 String insertSQL = "INSERT INTO ranked_feed (user_id, post_id, score, `rank`) VALUES (?, ?, ?, ?)";
//                 try (PreparedStatement stmt = conn.prepareStatement(insertSQL)) {
//                     int batchCount = 0;
//                     int totalInserts = 0;

//                     while (iterator.hasNext()) {
//                         Tuple2<String, Map<Integer, Double>> record = iterator.next();
//                         String nodeId = record._1;
//                         Map<Integer, Double> scores = record._2;

//                         // Extract post ID from node ID (strip the 'p' prefix)
//                         int postId = Integer.parseInt(nodeId.substring(1));
                        
//                         // Skip if this post has no user scores
//                         if (scores.isEmpty()) {
//                             System.out.println("DEBUG: Post " + postId + " has no user scores, skipping");
//                             continue;
//                         }

//                         for (Map.Entry<Integer, Double> entry : scores.entrySet()) {
//                             int userId = entry.getKey();
//                             double score = entry.getValue();
                            
//                             // Skip very small scores to reduce noise
//                             //if (score < 0.0001) continue;

//                             stmt.setInt(1, userId);
//                             stmt.setInt(2, postId);
//                             stmt.setDouble(3, score);
//                             stmt.setInt(4, 0); // Rank will be updated later
                            
//                             stmt.addBatch();
//                             batchCount++;
                            
//                             // Execute batch every 100 records
//                             if (batchCount >= 100) {
//                                 int[] results = stmt.executeBatch();
//                                 totalInserts += Arrays.stream(results).sum();
//                                 batchCount = 0;
//                             }
//                         }
//                     }
                    
//                     // Execute any remaining batch items
//                     if (batchCount > 0) {
//                         int[] results = stmt.executeBatch();
//                         totalInserts += Arrays.stream(results).sum();
//                     }
                    
//                     System.out.println("DEBUG: Total records inserted into ranked_feed: " + totalInserts);
//                 }
//             } catch (SQLException | IOException e) {
//                 System.err.println("ERROR in writeRankedPostsToMySQL: " + e.getMessage());
//                 e.printStackTrace();
//                 throw new RuntimeException("Error writing to database", e);
//             }
//         });
//     }

//     public static void updateRanks() {
//         try (Connection conn = getConnection()) {
//             String updateSQL =
//                 "UPDATE ranked_feed rf1 JOIN (" +
//                 "    SELECT user_id, post_id, " +
//                 "    @rank := IF(@current_user = user_id, @rank + 1, 1) AS `rank`, " +
//                 "    @current_user := user_id " +
//                 "    FROM ranked_feed, (SELECT @rank := 0, @current_user := 0) r " +
//                 "    ORDER BY user_id, score DESC" +
//                 ") rf2 ON rf1.user_id = rf2.user_id AND rf1.post_id = rf2.post_id " +
//                 "SET rf1.`rank` = rf2.`rank`";

//             try (Statement stmt = conn.createStatement()) {
//             //System.out.printf("Inserting: user_id=%d, post_id=%d, score=%.4f%n", userId, postId, score);
//                 int updatedRows = stmt.executeUpdate(updateSQL);
//                 System.out.println("DEBUG: Updated ranks for " + updatedRows + " records");
//             }
//         } catch (SQLException | IOException e) {
//             System.err.println("ERROR updating ranks: " + e.getMessage());
//             e.printStackTrace();
//         }
//     }

//     public static List<Tuple2<Integer, String>> getUserHashtagEdges() {
//         List<Tuple2<Integer, String>> edges = new ArrayList<>();
//         try (Connection conn = getConnection()) {
//             String sql = "SELECT user_id, hashtag_text FROM users";
//             try (PreparedStatement stmt = conn.prepareStatement(sql);
//                  ResultSet rs = stmt.executeQuery()) {
//                 while (rs.next()) {
//                     int userId = rs.getInt("user_id");
//                     String json = rs.getString("hashtag_text");
//                     if (json != null) {
//                         List<String> tags = parseJsonArray(json);
//                         for (String tag : tags) {
//                             edges.add(new Tuple2<>(userId, tag.toLowerCase()));
//                         }
//                     }
//                 }
//             }
//         } catch (Exception e) {
//             e.printStackTrace();
//         }
//         return edges;
//     }

//     public static List<Tuple2<Integer, String>> getPostHashtagEdges() {
//         List<Tuple2<Integer, String>> edges = new ArrayList<>();
//         try (Connection conn = getConnection()) {
//             String sql = "SELECT post_id, hashtag_text FROM posts";
//             try (PreparedStatement stmt = conn.prepareStatement(sql);
//                  ResultSet rs = stmt.executeQuery()) {
//                 while (rs.next()) {
//                     int postId = rs.getInt("post_id");
//                     String json = rs.getString("hashtag_text");
//                     if (json != null) {
//                         List<String> tags = parseJsonArray(json);
//                         for (String tag : tags) {
//                             edges.add(new Tuple2<>(postId, tag.toLowerCase()));
//                         }
//                     }
//                 }
//             }
//         } catch (Exception e) {
//             e.printStackTrace();
//         }
//         return edges;
//     }

//     private static List<String> parseJsonArray(String jsonArray) throws IOException {
//         ObjectMapper mapper = new ObjectMapper();
//         return mapper.readValue(jsonArray, new TypeReference<List<String>>() {});
//     }
// }

package server.ranking;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import scala.Tuple2;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.sql.*;
import java.util.*;
import java.util.Properties;

import org.apache.spark.api.java.JavaPairRDD;

public class DBUtils {

    public static Properties loadDBCredentialsFromEnv(String envPath) throws IOException {
        Properties props = new Properties();
        BufferedReader reader = new BufferedReader(new FileReader(envPath));
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains("=")) {
                String[] parts = line.split("=", 2);
                String key = parts[0].trim();
                String value = parts[1].trim();
                if (key.equals("DATABASE_SERVER")) props.setProperty("host", value);
                else if (key.equals("DATABASE_NAME")) props.setProperty("db", value);
                else if (key.equals("DATABASE_USER")) props.setProperty("user", value);
                else if (key.equals("DATABASE_PASSWORD")) props.setProperty("password", value);
            }
        }
        reader.close();
        return props;
    }

    private static Connection getConnection() throws SQLException, IOException {
        Properties dbProps = loadDBCredentialsFromEnv(".env");

        String host = dbProps.getProperty("host");
        String db = dbProps.getProperty("db");
        String user = dbProps.getProperty("user");
        String password = dbProps.getProperty("password");

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("MySQL JDBC driver not found in classpath!", e);
        }
        return DriverManager.getConnection(
            "jdbc:mysql://" + host + ":3306/" + db, user, password
        );
    }

    public static List<Tuple2<Integer, Integer>> getUserLikes() {
        List<Tuple2<Integer, Integer>> likes = new ArrayList<>();

        try (Connection conn = getConnection()) {
            String sql = "SELECT user_id, post_id FROM post_likes";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {

                int count = 0;
                while (rs.next()) {
                    int userId = rs.getInt("user_id");
                    int postId = rs.getInt("post_id");
                    likes.add(new Tuple2<>(userId, postId));
                    count++;
                }
                System.out.println("DEBUG: Loaded " + count + " post likes from database");
            }
        } catch (SQLException | IOException e) {
            System.err.println("ERROR in getUserLikes: " + e.getMessage());
            e.printStackTrace();
        }

        return likes;
    }

    public static List<Tuple2<Integer, Integer>> getFriendEdges() {
        List<Tuple2<Integer, Integer>> friends = new ArrayList<>();

        try (Connection conn = getConnection()) {
            String sql = "SELECT follower, following FROM friends";
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {

                int count = 0;
                while (rs.next()) {
                    int follower = rs.getInt("follower");
                    int following = rs.getInt("following");
                    friends.add(new Tuple2<>(follower, following));
                    count++;
                }
                System.out.println("DEBUG: Loaded " + count + " friendship connections from database");
            }
        } catch (SQLException | IOException e) {
            System.err.println("ERROR in getFriendEdges: " + e.getMessage());
            e.printStackTrace();
        }

        return friends;
    }

    public static void writeRankedPostsToMySQL(JavaPairRDD<String, Map<Integer, Double>> labelVectors) {
        try (Connection conn = getConnection()) {
            try (Statement stmt = conn.createStatement()) {
                stmt.executeUpdate("TRUNCATE TABLE ranked_feed");
                System.out.println("DEBUG: Cleared existing ranked_feed table");
            }
        } catch (SQLException | IOException e) {
            System.err.println("ERROR clearing ranked_feed table: " + e.getMessage());
            e.printStackTrace();
        }

        // Filter to only post nodes
        JavaPairRDD<String, Map<Integer, Double>> postNodes = labelVectors.filter(record -> record._1.startsWith("p"));
        long postNodeCount = postNodes.count();
        System.out.println("DEBUG: Found " + postNodeCount + " post nodes to process for ranked feed");

        postNodes.take(3).forEach(t -> System.out.println("DEBUG: PostNode=" + t._1 + " - Scores=" + t._2));

        if (postNodeCount == 0) {
            System.out.println("WARNING: No post nodes found in label vectors! Check graph construction.");
            return;
        }

        // Batch insert with foreachPartition
        postNodes.foreachPartition(iterator -> {
            try (Connection conn = getConnection()) {
                String insertSQL = "INSERT INTO ranked_feed (user_id, post_id, score, `rank`) VALUES (?, ?, ?, ?)";
                try (PreparedStatement stmt = conn.prepareStatement(insertSQL)) {
                    int batchCount = 0;
                    int totalInserts = 0;

                    while (iterator.hasNext()) {
                        Tuple2<String, Map<Integer, Double>> record = iterator.next();
                        String nodeId = record._1;
                        Map<Integer, Double> scores = record._2;

                        // Extract post ID from node ID (strip the 'p' prefix)
                        int postId = Integer.parseInt(nodeId.substring(1));
                        
                        if (scores == null) {
                        System.out.println("DEBUG: Post " + postId + " has NULL scores map");
                        continue;
                    }

                        // Skip if this post has no user scores
                        if (scores.isEmpty()) {
                            System.out.println("DEBUG: Post " + postId + " has no user scores, skipping");
                            continue;
                        }

                        System.out.println("DEBUG: Post " + postId + " has scores from users: " + scores.keySet());

                        for (Map.Entry<Integer, Double> entry : scores.entrySet()) {
                            int userId = entry.getKey();
                            double score = entry.getValue();
                            
                            // Skip very small scores to reduce noise
                            //if (score < 0.0001) continue;

                            
                            if (score < 0.001) {
                                System.out.println("DEBUG: Very low score (" + score + ") for user " + userId + " on post " + postId);
                            }

                            stmt.setInt(1, userId);
                            stmt.setInt(2, postId);
                            stmt.setDouble(3, score);
                            stmt.setInt(4, 0); // Rank will be updated later
                            
                            stmt.addBatch();
                            batchCount++;
                            
                            // Execute batch every 100 records
                            if (batchCount >= 100) {
                                int[] results = stmt.executeBatch();
                                totalInserts += Arrays.stream(results).sum();
                                batchCount = 0;
                            }
                        }
                    }
                    
                    // Execute any remaining batch items
                    if (batchCount > 0) {
                        int[] results = stmt.executeBatch();
                        totalInserts += Arrays.stream(results).sum();
                    }
                    
                    System.out.println("DEBUG: Total records inserted into ranked_feed: " + totalInserts);
                }
            } catch (SQLException | IOException e) {
                System.err.println("ERROR in writeRankedPostsToMySQL: " + e.getMessage());
                e.printStackTrace();
                throw new RuntimeException("Error writing to database", e);
            }
        });
    }

    public static void updateRanks() {
        try (Connection conn = getConnection()) {
            String updateSQL =
                "UPDATE ranked_feed rf1 JOIN (" +
                "    SELECT user_id, post_id, " +
                "    @rank := IF(@current_user = user_id, @rank + 1, 1) AS `rank`, " +
                "    @current_user := user_id " +
                "    FROM ranked_feed, (SELECT @rank := 0, @current_user := 0) r " +
                "    ORDER BY user_id, score DESC" +
                ") rf2 ON rf1.user_id = rf2.user_id AND rf1.post_id = rf2.post_id " +
                "SET rf1.`rank` = rf2.`rank`";

            try (Statement stmt = conn.createStatement()) {
            //System.out.printf("Inserting: user_id=%d, post_id=%d, score=%.4f%n", userId, postId, score);
                int updatedRows = stmt.executeUpdate(updateSQL);
                System.out.println("DEBUG: Updated ranks for " + updatedRows + " records");
            }
        } catch (SQLException | IOException e) {
            System.err.println("ERROR updating ranks: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static List<Tuple2<Integer, String>> getUserHashtagEdges() {
        List<Tuple2<Integer, String>> edges = new ArrayList<>();
        try (Connection conn = getConnection()) {
            String sql = "SELECT user_id, hashtag_text FROM users";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    int userId = rs.getInt("user_id");
                    String json = rs.getString("hashtag_text");
                    if (json != null) {
                        List<String> tags = parseJsonArray(json);
                        for (String tag : tags) {
                            edges.add(new Tuple2<>(userId, tag.toLowerCase()));
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return edges;
    }

    public static List<Tuple2<Integer, String>> getPostHashtagEdges() {
        List<Tuple2<Integer, String>> edges = new ArrayList<>();
        try (Connection conn = getConnection()) {
            String sql = "SELECT post_id, hashtag_text FROM posts";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    int postId = rs.getInt("post_id");
                    String json = rs.getString("hashtag_text");
                    if (json != null) {
                        List<String> tags = parseJsonArray(json);
                        for (String tag : tags) {
                            edges.add(new Tuple2<>(postId, tag.toLowerCase()));
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return edges;
    }

    private static List<String> parseJsonArray(String jsonArray) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(jsonArray, new TypeReference<List<String>>() {});
    }

    public static Set<Integer> getFederatedPostIds() {
    Set<Integer> ids = new HashSet<>();
    try (Connection conn = getConnection();
         PreparedStatement stmt = conn.prepareStatement("SELECT post_id FROM posts WHERE is_external = 1");
         ResultSet rs = stmt.executeQuery()) {
        while (rs.next()) {
            ids.add(rs.getInt("post_id"));
        }
    } catch (Exception e) {
        System.err.println("DBUtils.getFederatedPostIds error: " + e.getMessage());
    }
    return ids;
}

public static Set<Integer> getAllUserIds() {
    Set<Integer> ids = new HashSet<>();
    try (Connection conn = getConnection();
         PreparedStatement stmt = conn.prepareStatement("SELECT user_id FROM users");
         ResultSet rs = stmt.executeQuery()) {
        while (rs.next()) {
            ids.add(rs.getInt("user_id"));
        }
    } catch (Exception e) {
        System.err.println("DBUtils.getAllUserIds error: " + e.getMessage());
    }
    return ids;
}

}

