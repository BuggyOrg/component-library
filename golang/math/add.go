func addProcess(s1 chan int, s2 chan int, output chan int) {
  for {
    v1 := <- s1
    v2 := <- s2
    output <- v1 + v2
  }
}
