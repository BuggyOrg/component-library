func addProcess(s1 chan int, s2 chan int, sum chan int) {
  for {
    v1 := <- s1
    v2 := <- s2
    sum <- v1 + v2
  }
}
