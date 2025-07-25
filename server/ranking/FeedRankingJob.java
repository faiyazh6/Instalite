// package server.ranking;

// import org.apache.spark.SparkConf;
// import org.apache.spark.api.java.JavaPairRDD;
// import org.apache.spark.api.java.JavaSparkContext;

// import java.util.Map;
// import scala.Tuple2;

// public class FeedRankingJob {
//     public static void main(String[] args) {
//         // 1. Spark configuration
//         SparkConf conf = new SparkConf()
//                 .setAppName("InstaLite Feed Ranking")
//                 .setMaster("local[*]");  // Use all cores locally for testing
//         JavaSparkContext sc = new JavaSparkContext(conf);

//         try {
//             System.out.println("Starting feed ranking job...");
            
//             // 2. Build the graph: (source, (destination, weight))
//             JavaPairRDD<String, Tuple2<String, Double>> graphEdges = GraphBuilder.buildGraphEdges(sc);
//             long edgeCount = graphEdges.count();
//             System.out.println("Total edges in graph: " + edgeCount);

//             //DEBUG : Show sample edges
//             graphEdges.take(10).forEach(e ->
//                 System.out.println("Edge: " + e._1() + " -> " + e._2()._1() + " (weight " + e._2()._2() + ")")
//             );


//             if (edgeCount > 0) {
//                 // 3. Run adsorption algorithm
//                 JavaPairRDD<String, Map<Integer, Double>> labelVectors = Adsorption.run(sc, graphEdges);
//                 //DEBUGGING UNTIL NODECOUNT
//                 labelVectors.take(30).forEach(lv -> {
//                     String node = lv._1();
//                     String type = node.startsWith("p") ? "POST" : (node.startsWith("u") ? "USER" : (node.startsWith("h") ? "HASHTAG" : "OTHER"));
//                     System.out.println("DEBUG LabelVec Node: " + node + " (" + type + ") -> " + lv._2());
//                 });

//                 long nodeCount = labelVectors.count();
//                 System.out.println("Total nodes with labels: " + nodeCount);

//                 //DEBUGGING REAL
//                 System.out.println("Sample ranked vertices:");
//                 List<Tuple2<Object, Double>> sampleRanks = rankedVertices.take(20);
//                 for (Tuple2<Object, Double> entry : sampleRanks) {
//                     String node = entry._1.toString();
//                     double score = entry._2;
//                     System.out.println("Ranked node: " + node + ", score: " + score);
//                 }
//                 // DEBUG: Show sample label vectors
//                 labelVectors.take(10).forEach(lv -> {
//                     System.out.println("Node: " + lv._1() + " Labels: " + lv._2());
//                 });

//                 // 4. Write top ranked posts to database
//                 System.out.println("Preparing to write to DB...");
//                 System.out.println("Sample records:");
//                 labelVectors.take(5).forEach(System.out::println);
//                 DBUtils.writeRankedPostsToMySQL(labelVectors);
                
//                 System.out.println("Feed ranking job completed successfully!");
//             } else {
//                 System.out.println("WARNING: No edges found in graph. Check if post_likes and friends tables have data.");
//             }
//         } catch (Exception e) {
//             System.err.println("Error in feed ranking job: " + e.getMessage());
//             e.printStackTrace();
//         } finally {
//             // 5. Stop Spark
//             sc.stop();
//         }
//     }
// }

package server.ranking;

import org.apache.spark.SparkConf;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaSparkContext;

import java.util.List;
import java.util.Map;
import scala.Tuple2;

public class FeedRankingJob {
    public static void main(String[] args) {
        // 1. Spark configuration
        SparkConf conf = new SparkConf()
                .setAppName("InstaLite Feed Ranking")
                .setMaster("local[*]");  // Use all cores locally for testing
        JavaSparkContext sc = new JavaSparkContext(conf);

        try {
            System.out.println("Starting feed ranking job...");
            
            // 2. Build the graph: (source, (destination, weight))
            JavaPairRDD<String, Tuple2<String, Double>> graphEdges = GraphBuilder.buildGraphEdges(sc);
            long edgeCount = graphEdges.count();
            System.out.println("Total edges in graph: " + edgeCount);

            // DEBUG: Show sample edges
            List<Tuple2<String, Tuple2<String, Double>>> sampleEdges = graphEdges.take(10);
            System.out.println("Sample edges:");
            for (Tuple2<String, Tuple2<String, Double>> edge : sampleEdges) {
                System.out.println("Edge: " + edge._1() + " -> " + edge._2()._1() + " (weight " + edge._2()._2() + ")");
            }

            if (edgeCount > 0) {
                // 3. Run adsorption algorithm
                JavaPairRDD<String, Map<Integer, Double>> labelVectors = Adsorption.run(sc, graphEdges);
                
                // Debug: Show node counts by type
                long totalNodes = labelVectors.count();
                long userNodes = labelVectors.filter(node -> node._1.startsWith("u")).count();
                long postNodes = labelVectors.filter(node -> node._1.startsWith("p")).count();
                long hashtagNodes = labelVectors.filter(node -> node._1.startsWith("h")).count();
                
                System.out.println("Total nodes: " + totalNodes);
                System.out.println("User nodes: " + userNodes);
                System.out.println("Post nodes: " + postNodes);
                System.out.println("Hashtag nodes: " + hashtagNodes);
                
                // DEBUGGING: Show sample label vectors
                System.out.println("Sample label vectors:");
                List<Tuple2<String, Map<Integer, Double>>> sampleLabelVectors = labelVectors.take(20);
                for (Tuple2<String, Map<Integer, Double>> lv : sampleLabelVectors) {
                    String node = lv._1();
                    String type = node.startsWith("p") ? "POST" : (node.startsWith("u") ? "USER" : (node.startsWith("h") ? "HASHTAG" : "OTHER"));
                    System.out.println("Node: " + node + " (" + type + ") - " + lv._2());
                }

                // 4. Write top ranked posts to database
                System.out.println("Preparing to write to DB...");
                DBUtils.writeRankedPostsToMySQL(labelVectors);
                
                // 5. Update ranks in the database
                DBUtils.updateRanks();
                
                System.out.println("Feed ranking job completed successfully!");
            } else {
                System.out.println("WARNING: No edges found in graph. Check if post_likes and friends tables have data.");
            }
        } catch (Exception e) {
            System.err.println("Error in feed ranking job: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // 6. Stop Spark
            sc.stop();
        }
    }
}