// package server.ranking;

// import org.apache.spark.api.java.JavaPairRDD;
// import org.apache.spark.api.java.JavaRDD;
// import org.apache.spark.api.java.JavaSparkContext;
// import scala.Tuple2;

// import java.util.ArrayList;
// import java.util.List;

// public class GraphBuilder {

//     public static JavaPairRDD<String, Tuple2<String, Double>> buildGraphEdges(JavaSparkContext sc) {
//         List<Tuple2<String, Tuple2<String, Double>>> edges = new ArrayList<>();

//         // Get real edges from DB
//         List<Tuple2<Integer, Integer>> likes = DBUtils.getUserLikes(); // (user_id, post_id)
//         System.out.println("DEBUG: Processing " + likes.size() + " user likes for graph building");
        
//         for (Tuple2<Integer, Integer> like : likes) {
//             int userId = like._1();
//             int postId = like._2();
            
//             // Create node IDs with prefixes for clarity
//             String userNodeId = "u" + userId;
//             String postNodeId = "p" + postId;
            
//             // User likes post edge
//             edges.add(new Tuple2<>(userNodeId, new Tuple2<>(postNodeId, 0.4)));
//             // Post liked by user edge (reverse)
//             edges.add(new Tuple2<>(postNodeId, new Tuple2<>(userNodeId, 1.0)));
//         }

//         // Add friendship edges
//         List<Tuple2<Integer, Integer>> friends = DBUtils.getFriendEdges();
//         System.out.println("DEBUG: Processing " + friends.size() + " friendship connections for graph building");
        
//         for (Tuple2<Integer, Integer> f : friends) {
//             int user1 = f._1();
//             int user2 = f._2();
            
//             // Create user node IDs with prefix
//             String user1NodeId = "u" + user1;
//             String user2NodeId = "u" + user2;
            
//             // Friendship edges (bidirectional)
//             edges.add(new Tuple2<>(user1NodeId, new Tuple2<>(user2NodeId, 0.3)));
//             edges.add(new Tuple2<>(user2NodeId, new Tuple2<>(user1NodeId, 0.3)));
//         }

//         // You can add more edge types here: hashtag associations, follows, etc.

//         System.out.println("DEBUG: Total edges created for graph: " + edges.size());
//         if (edges.isEmpty()) {
//             System.out.println("WARNING: No edges were created. Check if post_likes and friends tables have data.");
//         }
        
//         return sc.parallelizePairs(edges);
//     }
// }

// package server.ranking;

// import org.apache.spark.api.java.JavaPairRDD;
// import org.apache.spark.api.java.JavaSparkContext;
// import scala.Tuple2;

// import java.sql.*;
// import java.util.*;

// public class GraphBuilder {

//     public static JavaPairRDD<String, Tuple2<String, Double>> buildGraphEdges(JavaSparkContext sc) {
//         List<Tuple2<String, Tuple2<String, Double>>> edges = new ArrayList<>();

//         // --- Likes: u -> p and p -> u ---
//         List<Tuple2<Integer, Integer>> likes = DBUtils.getUserLikes();
//         System.out.println("DEBUG: Processing " + likes.size() + " user likes for graph building");
//         Map<Integer, List<Integer>> userLikesMap = new HashMap<>();
//         for (Tuple2<Integer, Integer> like : likes) {
//             userLikesMap.computeIfAbsent(like._1(), k -> new ArrayList<>()).add(like._2());
//         }
//         for (Map.Entry<Integer, List<Integer>> entry : userLikesMap.entrySet()) {
//             int userId = entry.getKey();
//             List<Integer> likedPosts = entry.getValue();
//             double weight = 0.4 / likedPosts.size();
//             String userNode = "u" + userId;
//             for (int postId : likedPosts) {
//                 String postNode = "p" + postId;
//                 edges.add(new Tuple2<>(userNode, new Tuple2<>(postNode, weight)));
//                 edges.add(new Tuple2<>(postNode, new Tuple2<>(userNode, 1.0)));
//             }
//         }

//         // --- Friendships: u <-> u ---
//         List<Tuple2<Integer, Integer>> friends = DBUtils.getFriendEdges();
//         System.out.println("DEBUG: Processing " + friends.size() + " friendship connections for graph building");
//         Map<Integer, Set<Integer>> friendMap = new HashMap<>();
//         for (Tuple2<Integer, Integer> f : friends) {
//             friendMap.computeIfAbsent(f._1(), k -> new HashSet<>()).add(f._2());
//             friendMap.computeIfAbsent(f._2(), k -> new HashSet<>()).add(f._1());
//         }
//         for (Map.Entry<Integer, Set<Integer>> entry : friendMap.entrySet()) {
//             int user = entry.getKey();
//             List<Integer> friendsList = new ArrayList<>(entry.getValue());
//             double weight = 0.3 / friendsList.size();
//             String userNode = "u" + user;
//             for (int friend : friendsList) {
//                 String friendNode = "u" + friend;
//                 edges.add(new Tuple2<>(userNode, new Tuple2<>(friendNode, weight)));
//             }
//         }

//         // --- User-Hashtag edges: u <-> h ---
//         List<Tuple2<Integer, String>> userTags = DBUtils.getUserHashtagEdges();
//         Map<Integer, List<String>> userToTags = new HashMap<>();
//         for (Tuple2<Integer, String> edge : userTags) {
//             userToTags.computeIfAbsent(edge._1(), k -> new ArrayList<>()).add(edge._2());
//         }
//         for (Map.Entry<Integer, List<String>> entry : userToTags.entrySet()) {
//             int userId = entry.getKey();
//             List<String> tags = entry.getValue();
//             double weight = 0.3 / tags.size();
//             String userNode = "u" + userId;
//             for (String tag : tags) {
//                 String tagNode = "h" + tag.toLowerCase();
//                 edges.add(new Tuple2<>(userNode, new Tuple2<>(tagNode, weight)));
//                 edges.add(new Tuple2<>(tagNode, new Tuple2<>(userNode, weight)));
//             }
//         }

//         // --- Post-Hashtag edges: p <-> h ---
//         List<Tuple2<Integer, String>> postTags = DBUtils.getPostHashtagEdges();
//         Map<Integer, List<String>> postToTags = new HashMap<>();
//         for (Tuple2<Integer, String> edge : postTags) {
//             postToTags.computeIfAbsent(edge._1(), k -> new ArrayList<>()).add(edge._2());
//         }
//         for (Map.Entry<Integer, List<String>> entry : postToTags.entrySet()) {
//             int postId = entry.getKey();
//             List<String> tags = entry.getValue();
//             double weight = 1.0 / tags.size();
//             String postNode = "p" + postId;
//             for (String tag : tags) {
//                 String tagNode = "h" + tag.toLowerCase();
//                 edges.add(new Tuple2<>(postNode, new Tuple2<>(tagNode, weight)));
//                 edges.add(new Tuple2<>(tagNode, new Tuple2<>(postNode, weight)));
//             }
//         }

//         System.out.println("DEBUG: Total edges created for graph: " + edges.size());
//         if (edges.isEmpty()) {
//             System.out.println("WARNING: No edges were created. Check if post_likes and friends tables have data.");
//         }

//         return sc.parallelizePairs(edges);
//     }
// }

package server.ranking;

import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaSparkContext;
import scala.Tuple2;

import java.sql.*;
import java.util.*;

public class GraphBuilder {

    public static JavaPairRDD<String, Tuple2<String, Double>> buildGraphEdges(JavaSparkContext sc) {
        List<Tuple2<String, Tuple2<String, Double>>> edges = new ArrayList<>();

        // --- Likes: u -> p and p -> u ---
        List<Tuple2<Integer, Integer>> likes = DBUtils.getUserLikes();
        System.out.println("DEBUG: Processing " + likes.size() + " user likes for graph building");
        Map<Integer, List<Integer>> userLikesMap = new HashMap<>();
        for (Tuple2<Integer, Integer> like : likes) {
            userLikesMap.computeIfAbsent(like._1(), k -> new ArrayList<>()).add(like._2());
        }
        for (Map.Entry<Integer, List<Integer>> entry : userLikesMap.entrySet()) {
            int userId = entry.getKey();
            List<Integer> likedPosts = entry.getValue();
            double weight = 0.4 / likedPosts.size();
            String userNode = "u" + userId;
            for (int postId : likedPosts) {
                String postNode = "p" + postId;
                edges.add(new Tuple2<>(userNode, new Tuple2<>(postNode, weight)));
                edges.add(new Tuple2<>(postNode, new Tuple2<>(userNode, 1.0)));
            }
        }

        // --- Friendships: u <-> u ---
        List<Tuple2<Integer, Integer>> friends = DBUtils.getFriendEdges();
        System.out.println("DEBUG: Processing " + friends.size() + " friendship connections for graph building");
        Map<Integer, Set<Integer>> friendMap = new HashMap<>();
        for (Tuple2<Integer, Integer> f : friends) {
            friendMap.computeIfAbsent(f._1(), k -> new HashSet<>()).add(f._2());
            friendMap.computeIfAbsent(f._2(), k -> new HashSet<>()).add(f._1());
        }
        for (Map.Entry<Integer, Set<Integer>> entry : friendMap.entrySet()) {
            int user = entry.getKey();
            List<Integer> friendsList = new ArrayList<>(entry.getValue());
            double weight = 0.3 / friendsList.size();
            String userNode = "u" + user;
            for (int friend : friendsList) {
                String friendNode = "u" + friend;
                edges.add(new Tuple2<>(userNode, new Tuple2<>(friendNode, weight)));
            }
        }

        // --- User-Hashtag edges: u <-> h ---
        List<Tuple2<Integer, String>> userTags = DBUtils.getUserHashtagEdges();
        Map<Integer, List<String>> userToTags = new HashMap<>();
        for (Tuple2<Integer, String> edge : userTags) {
            userToTags.computeIfAbsent(edge._1(), k -> new ArrayList<>()).add(edge._2());
        }
        for (Map.Entry<Integer, List<String>> entry : userToTags.entrySet()) {
            int userId = entry.getKey();
            List<String> tags = entry.getValue();
            double weight = 0.3 / tags.size();
            String userNode = "u" + userId;
            for (String tag : tags) {
                String tagNode = "h" + tag.toLowerCase();
                edges.add(new Tuple2<>(userNode, new Tuple2<>(tagNode, weight)));
                edges.add(new Tuple2<>(tagNode, new Tuple2<>(userNode, weight)));
            }
        }

        // --- Post-Hashtag edges: p <-> h ---
        List<Tuple2<Integer, String>> postTags = DBUtils.getPostHashtagEdges();
        Map<Integer, List<String>> postToTags = new HashMap<>();
        for (Tuple2<Integer, String> edge : postTags) {
            postToTags.computeIfAbsent(edge._1(), k -> new ArrayList<>()).add(edge._2());
        }
        for (Map.Entry<Integer, List<String>> entry : postToTags.entrySet()) {
            int postId = entry.getKey();
            List<String> tags = entry.getValue();
            double weight = 1.0 / tags.size();
            String postNode = "p" + postId;
            for (String tag : tags) {
                String tagNode = "h" + tag.toLowerCase();
                edges.add(new Tuple2<>(postNode, new Tuple2<>(tagNode, weight)));
                edges.add(new Tuple2<>(tagNode, new Tuple2<>(postNode, weight)));
            }
        }

        //ADDING EDGES FOR FEDERATED POSTS
        Set<Integer> federatedPostIds = DBUtils.getFederatedPostIds(); // New method in DBUtils
        Set<Integer> allUserIds = DBUtils.getAllUserIds();             // New method in DBUtils

        for (int postId : federatedPostIds) {
            String postNode = "p" + postId;
            for (int userId : allUserIds) {
                String userNode = "u" + userId;
                edges.add(new Tuple2<>(postNode, new Tuple2<>(userNode, 0.01)));  // weak recommendation
                edges.add(new Tuple2<>(userNode, new Tuple2<>(postNode, 0.01)));
            }
        }
        // FINISHED ADDING EDGES FOR FEDERATED POSTS
        System.out.println("DEBUG: Total edges created for graph: " + edges.size());
        for (Tuple2<String, Tuple2<String, Double>> edge : edges) {
    String src = edge._1();
    String dst = edge._2()._1();
    if (src.startsWith("u") && dst.startsWith("p")) {
        System.out.println("DEBUG: User-to-post edge: " + edge);
    }
}
        if (edges.isEmpty()) {
            System.out.println("WARNING: No edges were created. Check if post_likes and friends tables have data.");
        }

        return sc.parallelizePairs(edges);
    }
}
