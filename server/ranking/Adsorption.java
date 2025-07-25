// package server.ranking;

// import org.apache.spark.api.java.JavaPairRDD;
// import org.apache.spark.api.java.JavaSparkContext;
// import scala.Tuple2;

// import java.util.*;

// public class Adsorption {

//     // Each node has a label vector: Map<Integer, Double>
//     public static JavaPairRDD<String, Map<Integer, Double>> run(
//             JavaSparkContext sc,
//             JavaPairRDD<String, Tuple2<String, Double>> edges) {

//         // Step 1: Initialize label vectors
//         JavaPairRDD<String, Map<Integer, Double>> labels = initializeLabels(edges);

//         // Step 2: Run up to 15 iterations or until convergence
//         for (int i = 0; i < 15; i++) {
//             JavaPairRDD<String, Map<Integer, Double>> newLabels = propagateLabels(edges, labels);
//             labels = newLabels;
//         }

//         return labels;
//     }

//     private static JavaPairRDD<String, Map<Integer, Double>> initializeLabels(
//             JavaPairRDD<String, Tuple2<String, Double>> edges) {

//         // Users only: each user starts with label = {userId: 1.0}
//         JavaPairRDD<String, Map<Integer, Double>> initialLabels = edges
//                 .keys()
//                 .distinct()
//                 .filter(id -> id.startsWith("u")) // Only user nodes get labels
//                 .mapToPair(id -> {
//                     Map<Integer, Double> labelVec = new HashMap<>();
//                     // Extract integer user ID from string with "u" prefix
//                     int userId = Integer.parseInt(id.substring(1));
//                     labelVec.put(userId, 1.0);
//                     return new Tuple2<>(id, labelVec);
//                 });

//         return initialLabels;
//     }

//     private static JavaPairRDD<String, Map<Integer, Double>> propagateLabels(
//             JavaPairRDD<String, Tuple2<String, Double>> edges,
//             JavaPairRDD<String, Map<Integer, Double>> labels) {

//         // Step 1: Join edges with source labels
//         JavaPairRDD<String, Tuple2<Tuple2<String, Double>, Map<Integer, Double>>> joined =
//                 edges.join(labels);

//         // Step 2: Send labels along each edge
//         JavaPairRDD<String, Map<Integer, Double>> messages = joined.mapToPair(tuple -> {
//             String src = tuple._1;
//             Tuple2<String, Double> edge = tuple._2._1;
//             Map<Integer, Double> labelVec = tuple._2._2;

//             String dst = edge._1;
//             double weight = edge._2;

//             Map<Integer, Double> weightedLabels = new HashMap<>();
//             for (Map.Entry<Integer, Double> entry : labelVec.entrySet()) {
//                 weightedLabels.put(entry.getKey(), entry.getValue() * weight);
//             }

//             return new Tuple2<>(dst, weightedLabels);
//         });

//         // Step 3: Aggregate incoming label vectors for each node
//         JavaPairRDD<String, Map<Integer, Double>> updatedLabels = messages.reduceByKey((map1, map2) -> {
//             Map<Integer, Double> merged = new HashMap<>(map1);
//             for (Map.Entry<Integer, Double> entry : map2.entrySet()) {
//                 merged.merge(entry.getKey(), entry.getValue(), Double::sum);
//             }
//             return merged;
//         });

//         return updatedLabels;
//     }
// }

package server.ranking;

import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.api.java.Optional;
import scala.Tuple2;

import java.util.*;

public class Adsorption {

    private static final double ALPHA = 0.85;

    // Each node has a label vector: Map<Integer, Double>
    public static JavaPairRDD<String, Map<Integer, Double>> run(
            JavaSparkContext sc,
            JavaPairRDD<String, Tuple2<String, Double>> edges) {

        // Step 1: Initialize label vectors for user nodes
        JavaPairRDD<String, Map<Integer, Double>> labels = initializeLabels(edges);
        JavaPairRDD<String, Map<Integer, Double>> restartLabels = labels;

        System.out.println("Sample initialized labels:");
            for (Tuple2<String, Map<Integer, Double>> entry : labels.take(5)) {
                System.out.println("Node: " + entry._1 + ", Labels: " + entry._2);
            }

        // Get all nodes for step 3
        JavaPairRDD<String, Object> allNodes = edges.flatMap(edge -> {
            List<String> nodes = new ArrayList<>();
            nodes.add(edge._1);
            nodes.add(edge._2._1);
            return nodes.iterator();
        }).distinct().mapToPair(node -> new Tuple2<>(node, null));

        // Debug count of nodes
        long nodeCount = allNodes.count();
        System.out.println("DEBUG: Total nodes in graph: " + nodeCount);
        
        // Count post nodes
        long postNodeCount = allNodes.filter(node -> node._1.startsWith("p")).count();
        System.out.println("DEBUG: Total post nodes in graph: " + postNodeCount);

        // Step 2: Run up to 15 iterations or until convergence
        for (int i = 0; i < 20; i++) {
            System.out.println("DEBUG: Starting iteration " + (i+1));
            
            // Propagate labels along edges
            JavaPairRDD<String, Map<Integer, Double>> newMessages = propagateLabels(edges, labels);
            
            // Merge with existing labels to preserve the initialization for user nodes
            // Step 3: Add restart (jumping) logic
JavaPairRDD<String, Map<Integer, Double>> combinedWithRestart = newMessages.leftOuterJoin(restartLabels)
    .mapToPair(pair -> {
        String nodeId = pair._1;
        Map<Integer, Double> propagated = pair._2._1;
        Map<Integer, Double> restart = pair._2._2.orElse(new HashMap<>());

        Map<Integer, Double> blended = new HashMap<>();

        // Propagated labels with alpha
        for (Map.Entry<Integer, Double> entry : propagated.entrySet()) {
            blended.put(entry.getKey(), ALPHA * entry.getValue());
        }

        // Restart labels with (1 - alpha)
        for (Map.Entry<Integer, Double> entry : restart.entrySet()) {
            blended.merge(entry.getKey(), (1 - ALPHA) * entry.getValue(), Double::sum);
        }

        return new Tuple2<>(nodeId, blended);
    });

// Step 4: Normalize after blending
labels = normalizeLabels(combinedWithRestart);

            
            // Debug info for this iteration
            long nodesWithLabels = labels.count();
            long postsWithLabels = labels.filter(node -> node._1.startsWith("p")).count();
            System.out.println("DEBUG: Iteration " + (i+1) + " - Nodes with labels: " + nodesWithLabels);
            System.out.println("DEBUG: Iteration " + (i+1) + " - Post nodes with labels: " + postsWithLabels);
        }

        // Step 3: Ensure all nodes are included in the result (even if they have no labels)
        JavaPairRDD<String, Map<Integer, Double>> finalLabels = allNodes.leftOuterJoin(labels)
            .mapToPair(tuple -> {
                String nodeId = tuple._1;
                Optional<Map<Integer, Double>> labelOpt = tuple._2._2;
                Map<Integer, Double> labelVec = labelOpt.orElse(new HashMap<>());
                return new Tuple2<>(nodeId, labelVec);
            });
            
        // Debug final state
        long finalNodesWithLabels = finalLabels.count();
        long finalPostsWithLabels = finalLabels.filter(node -> node._1.startsWith("p")).count();
        System.out.println("DEBUG: Final nodes with labels: " + finalNodesWithLabels);
        System.out.println("DEBUG: Final post nodes with labels: " + finalPostsWithLabels);
        
        return finalLabels;
    }

    private static JavaPairRDD<String, Map<Integer, Double>> initializeLabels(
            JavaPairRDD<String, Tuple2<String, Double>> edges) {

        // Users only: each user starts with label = {userId: 1.0}
        JavaPairRDD<String, Map<Integer, Double>> initialLabels = edges
                .keys()
                .union(edges.values().map(Tuple2::_1))  // Include all nodes, not just edge sources
                .distinct()
                .filter(id -> id.startsWith("u")) // Only user nodes get labels
                .mapToPair(id -> {
                    Map<Integer, Double> labelVec = new HashMap<>();
                    // Extract integer user ID from string with "u" prefix
                    int userId = Integer.parseInt(id.substring(1));
                    labelVec.put(userId, 1.0);
                    return new Tuple2<>(id, labelVec);
                });

        long initialLabelCount = initialLabels.count();
        System.out.println("DEBUG: Initialized labels for " + initialLabelCount + " user nodes");
        
        return initialLabels;
    }

    private static JavaPairRDD<String, Map<Integer, Double>> propagateLabels(
            JavaPairRDD<String, Tuple2<String, Double>> edges,
            JavaPairRDD<String, Map<Integer, Double>> labels) {

        // Step 1: Join edges with source labels
        JavaPairRDD<String, Tuple2<Tuple2<String, Double>, Map<Integer, Double>>> joined =
                edges.join(labels);

        // Step 2: Send labels along each edge
        JavaPairRDD<String, Map<Integer, Double>> messages = joined.mapToPair(tuple -> {
            String src = tuple._1;
            Tuple2<String, Double> edge = tuple._2._1;
            Map<Integer, Double> labelVec = tuple._2._2;

            String dst = edge._1;
            double weight = edge._2;

            Map<Integer, Double> weightedLabels = new HashMap<>();
            for (Map.Entry<Integer, Double> entry : labelVec.entrySet()) {
                weightedLabels.put(entry.getKey(), entry.getValue() * weight);
            }

            return new Tuple2<>(dst, weightedLabels);
        });

        // Step 3: Aggregate incoming label vectors for each node
        JavaPairRDD<String, Map<Integer, Double>> updatedLabels = messages.reduceByKey((map1, map2) -> {
            Map<Integer, Double> merged = new HashMap<>(map1);
            for (Map.Entry<Integer, Double> entry : map2.entrySet()) {
                merged.merge(entry.getKey(), entry.getValue(), Double::sum);
            }
            return merged;
        });

        return updatedLabels;
    }
    
    private static JavaPairRDD<String, Map<Integer, Double>> normalizeLabels(
            JavaPairRDD<String, Map<Integer, Double>> labels) {
            
        return labels.mapToPair(tuple -> {
            String nodeId = tuple._1;
            Map<Integer, Double> labelVec = tuple._2;
            
            // Calculate sum of all values
            double sum = labelVec.values().stream().mapToDouble(Double::doubleValue).sum();
            
            // If sum is zero or very small, return as is
            // if (sum < 0.000001) {
            //     return tuple;
            // }
            
            // Normalize
            Map<Integer, Double> normalizedVec = new HashMap<>();
            for (Map.Entry<Integer, Double> entry : labelVec.entrySet()) {
                normalizedVec.put(entry.getKey(), entry.getValue() / sum);
            }
            
            return new Tuple2<>(nodeId, normalizedVec);
        });
    }
}
